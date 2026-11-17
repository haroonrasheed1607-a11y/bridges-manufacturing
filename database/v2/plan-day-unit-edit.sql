-- Stage first. Production requires a separately approved migration transaction.
do $$ begin
 if not exists(select 1 from public.customers where id='STAGE-CLIENT')
  and current_setting('bridges.release_approval',true) is distinct from 'plan-day-approved' then
  raise exception 'This plan-day change requires staging or explicit release approval';
 end if;
end $$;

create table manufacturing_private.plan_day_unit_changes(
 request_id uuid primary key, actor_id uuid not null, job_id text not null, work_date date not null,
 old_units_per_scan integer not null, new_units_per_scan integer not null, reset_requested boolean not null,
 scan_ids uuid[] not null default '{}', snapshot jsonb not null, result jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table manufacturing_private.plan_day_unit_changes enable row level security;
revoke all on manufacturing_private.plan_day_unit_changes from public,anon,authenticated,service_role;
create index plan_day_unit_changes_scan_ids_idx on manufacturing_private.plan_day_unit_changes using gin(scan_ids);

create function manufacturing_private.plan_day_unit_state(p_job text,p_date date)
returns jsonb language sql stable security definer set search_path='' as $$
 with bounds as(select p_date::timestamp at time zone 'America/Chicago' lo,(p_date+1)::timestamp at time zone 'America/Chicago' hi),
 scans as(
  select c.id,c.billable_units,c.completed_at,'reusable' kind from public.dumping_completions c
   join public.dumping_assignments d on d.id=c.assignment_id cross join bounds t
   where d.sub_job_id=p_job and c.completed_at>=t.lo and c.completed_at<t.hi
  union all
  select r.id,r.billable_units,r.completed_at,'box' from public.production_records r
   join public.boxes b on b.id=r.box_id cross join bounds t
   where b.sub_job_id=p_job and r.completed_at>=t.lo and r.completed_at<t.hi
 ), stats as(
  select count(*) scan_count,coalesce(sum(billable_units),0) units,
   count(*) filter(where billable_units is null)>0 unclassified,
   md5(coalesce(string_agg(kind||':'||id::text||':'||coalesce(billable_units::text,'null')||':'||extract(epoch from completed_at)::text,'|' order by kind,id),'')) fingerprint from scans
 ), state as(
  select j.total_billable_units,w.billable_units_per_scan,o.revision,
   (o.total_billable_units is not null and j.total_billable_units is not null) billable,
   (o.stage=1 and a.id is not null and a.revoked_at is null and a.completed_at is null) active,
   (select count(*)=1 from public.sub_jobs sibling where sibling.work_order_id=w.id) single_job,
   s.*,
   exists(select 1 from public.production_records r join public.boxes b on b.id=r.box_id cross join bounds t
     where b.sub_job_id=j.id and r.completed_at>=t.lo and r.completed_at<t.hi
      and (b.completed_at is null or b.completed_at<t.lo or b.completed_at>=t.hi
       or exists(select 1 from public.production_records other where other.box_id=b.id and (other.completed_at<t.lo or other.completed_at>=t.hi)))) mixed_box_dates
  from public.sub_jobs j join public.work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id
  left join public.scan_assign_approvals a on a.sub_job_id=j.id and a.work_date=p_date cross join stats s where j.id=p_job
 )
 select jsonb_build_object('billableUnitsPerScan',billable_units_per_scan,'totalBillableUnits',total_billable_units,
  'dayScanCount',scan_count,'dayBillableUnits',units,'scanFingerprint',fingerprint,'revision',revision,
  'requiresDayReset',scan_count>0,'canEditUnits',
    manufacturing_private.actor_role()='admin' and billable and active and single_job and not unclassified and not mixed_box_dates and (scan_count=0 or units*10<total_billable_units),
  'unitEditReason',case when not billable then 'Legacy pieces-based job'
    when not active then 'The plan is closed or no longer in production'
    when not single_job then 'This work order has multiple sub-jobs'
    when unclassified then 'This day contains legacy scan records'
    when mixed_box_dates then 'A box has records across multiple days; review it separately'
    when scan_count>0 and units*10>=total_billable_units then 'At least 10% of total BU has been scanned on this day'
    when manufacturing_private.actor_role()<>'admin' then 'Only an admin can change BU/Scan'
    else null end)
 from state;
$$;
revoke all on function manufacturing_private.plan_day_unit_state(text,date) from public,anon,authenticated,service_role;

create function manufacturing_private.edit_plan_day_units(
 p_job text,p_date date,p_units integer,p_reset boolean,p_revision bigint,p_fingerprint text,p_request uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing manufacturing_private.plan_day_unit_changes; state jsonb; oid text; wid text;
 lo timestamptz;hi timestamptz; archived jsonb; receipt jsonb; ids uuid[];removed integer;
begin
 if auth.uid() is null or manufacturing_private.actor_role() is distinct from 'admin' then raise exception 'Administrator access required' using errcode='42501';end if;
 if p_date is null or not isfinite(p_date) or p_job is null or p_request is null or p_reset is null or p_units is null or p_units not between 1 and 1000000 then raise exception 'Enter a valid planned day and whole BU/Scan quantity';end if;
 perform pg_advisory_xact_lock(hashtextextended('plan-day-units:'||p_request::text,0));
 select * into existing from manufacturing_private.plan_day_unit_changes where request_id=p_request;
 if existing.request_id is not null then
  if existing.actor_id is distinct from auth.uid() or existing.job_id is distinct from p_job or existing.work_date is distinct from p_date or existing.new_units_per_scan is distinct from p_units or existing.reset_requested is distinct from p_reset then raise exception 'This request reference has already been used';end if;
  return existing.result||'{"duplicate":true}';
 end if;
 select w.order_id,w.id into oid,wid from public.sub_jobs j join public.work_orders w on w.id=j.work_order_id where j.id=p_job;
 if oid is null then raise exception 'The planned job no longer exists';end if;
 perform 1 from public.orders where id=oid for update;
 perform 1 from public.sub_jobs where id=p_job for update;
 state:=manufacturing_private.plan_day_unit_state(p_job,p_date);
 if (state->>'revision')::bigint is distinct from p_revision or state->>'scanFingerprint' is distinct from p_fingerprint then raise exception 'Production changed. Refresh the planned day and review before saving.' using errcode='PT409';end if;
 if not coalesce((state->>'canEditUnits')::boolean,false) then raise exception '%',coalesce(state->>'unitEditReason','This plan cannot be changed');end if;
 if p_units>(state->>'totalBillableUnits')::integer then raise exception 'BU/Scan cannot exceed total billable units';end if;
 if (state->>'dayScanCount')::integer>0 and not p_reset then raise exception 'Confirm reset of this selected day before changing BU/Scan';end if;
 lo:=p_date::timestamp at time zone 'America/Chicago';hi:=(p_date+1)::timestamp at time zone 'America/Chicago';
 select jsonb_build_object(
  'reusable',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.dumping_completions c join public.dumping_assignments d on d.id=c.assignment_id where d.sub_job_id=p_job and c.completed_at>=lo and c.completed_at<hi),'[]'),
  'singleUse',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.production_records r join public.boxes b on b.id=r.box_id where b.sub_job_id=p_job and r.completed_at>=lo and r.completed_at<hi),'[]'),
  'boxBookings',coalesce((select jsonb_agg(to_jsonb(bk) order by bk.id) from public.bookings bk join public.boxes b on b.id=bk.id where b.sub_job_id=p_job and bk.starts_on=p_date and bk.ends_on=p_date and exists(select 1 from public.production_records r where r.box_id=b.id and r.completed_at>=lo and r.completed_at<hi)),'[]'),
  'boxes',coalesce((select jsonb_agg(to_jsonb(b) order by b.id) from public.boxes b where b.sub_job_id=p_job and exists(select 1 from public.production_records r where r.box_id=b.id and r.completed_at>=lo and r.completed_at<hi)),'[]')) into archived;
 select coalesce(array_agg((x->>'id')::uuid),'{}'::uuid[]) into ids from jsonb_array_elements((archived->'reusable')||(archived->'singleUse')) x;
 removed:=case when p_reset then (state->>'dayBillableUnits')::integer else 0 end;
 receipt:=jsonb_build_object('jobId',p_job,'date',p_date,'unitsPerScan',p_units,'removedUnits',removed,
  'removedScans',case when p_reset then (state->>'dayScanCount')::integer else 0 end,'duplicate',false);
 insert into manufacturing_private.plan_day_unit_changes(request_id,actor_id,job_id,work_date,old_units_per_scan,new_units_per_scan,reset_requested,scan_ids,snapshot,result)
 values(p_request,auth.uid(),p_job,p_date,(state->>'billableUnitsPerScan')::integer,p_units,p_reset,ids,archived,receipt);
 if p_reset then
  delete from public.dumping_completions c using public.dumping_assignments d where c.assignment_id=d.id and d.sub_job_id=p_job and c.completed_at>=lo and c.completed_at<hi;
  delete from public.production_records r using public.boxes b where r.box_id=b.id and b.sub_job_id=p_job and r.completed_at>=lo and r.completed_at<hi;
  delete from public.bookings bk where bk.id in (select x->>'id' from jsonb_array_elements(archived->'boxBookings') x);
  -- Retire completed single-use labels; they must not be replayed after reset.
  delete from public.boxes b where b.id in (select x->>'id' from jsonb_array_elements(archived->'boxes') x);
  update public.sub_jobs set completed=completed-removed where id=p_job;
  update public.dumping_assignments d set last_scan_at=(select max(c.completed_at) from public.dumping_completions c where c.assignment_id=d.id) where d.sub_job_id=p_job;
 end if;
 -- BU/Scan is a work-order setting, shared with its active assignments; the
 -- scan removal above is strictly limited to this job on the selected day.
 perform manufacturing_private.save_billable_scan_settings(wid,(select scan_cooldown_seconds from public.work_orders where id=wid),p_units);
 update public.orders set revision=revision+1,updated_at=clock_timestamp() where id=oid;
 insert into public.order_events(order_id,actor_id,message) values(oid,auth.uid(),format('Admin updated BU/Scan to %s for %s. Reset selected day %s: %s scans / %s BU removed; other days preserved.',p_units,p_job,p_date,receipt->>'removedScans',removed));
 return receipt;
end $$;
create function public.app_edit_plan_day_units(p_job text,p_date date,p_units integer,p_reset boolean,p_revision bigint,p_fingerprint text,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.edit_plan_day_units(p_job,p_date,p_units,p_reset,p_revision,p_fingerprint,p_request);$$;
revoke all on function manufacturing_private.edit_plan_day_units(text,date,integer,boolean,bigint,text,uuid),public.app_edit_plan_day_units(text,date,integer,boolean,bigint,text,uuid) from public,anon;
grant execute on function manufacturing_private.edit_plan_day_units(text,date,integer,boolean,bigint,text,uuid),public.app_edit_plan_day_units(text,date,integer,boolean,bigint,text,uuid) to authenticated;

create function manufacturing_private.assert_scan_not_reset(p_request uuid)
returns void language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from manufacturing_private.plan_day_unit_changes where scan_ids @>array[p_request]) then
  raise exception 'This scan was discarded by an admin. Scan again with a new request reference.' using errcode='PT409';
 end if;
end $$;
revoke all on function manufacturing_private.assert_scan_not_reset(uuid) from public,anon,authenticated,service_role;

do $patch$ declare original text;definition text;begin
 original:=pg_get_functiondef('manufacturing_private.planned_jobs(date)'::regprocedure);
 definition:=replace(original,'''billableMode'',o.total_billable_units is not null,','''unitEditState'',manufacturing_private.plan_day_unit_state(j.id,p_date),''billableMode'',o.total_billable_units is not null,');
 if definition=original then raise exception 'Unexpected planned jobs projection';end if;execute definition;
 original:=pg_get_functiondef('manufacturing_private.dumping_scan(text,uuid,integer,boolean)'::regprocedure);
 definition:=replace(original,'perform manufacturing_private.dumping_access(a.sub_job_id,false);','perform manufacturing_private.dumping_access(a.sub_job_id,false); perform manufacturing_private.assert_scan_not_reset(p_request);');
 if definition=original then raise exception 'Unexpected scan replay guard';end if;execute definition;
end $patch$;
