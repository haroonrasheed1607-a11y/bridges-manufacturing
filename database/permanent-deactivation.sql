-- Permanent deactivation. Apply only after the complete billing-unit migrations.
-- Staging fixture permits rehearsal; production requires separate approval.
do $$begin
 if not exists(select 1 from public.customers where id='STAGE-CLIENT') and current_setting('bridges.release_approval',true) is distinct from 'deactivation-approved' then
 raise exception 'Permanent deactivation requires explicit production approval';end if;
end$$;
alter table public.work_orders add column if not exists active boolean not null default true;
alter table public.work_orders add column deactivated_at timestamptz, add column deactivated_by uuid, add column deactivation_reason text;
alter table public.sub_jobs add column if not exists active boolean not null default true;
alter table public.sub_jobs add column deactivated_at timestamptz, add column deactivated_by uuid, add column deactivation_reason text;
alter table public.boxes add column if not exists active boolean not null default true;
alter table public.boxes add column deactivated_at timestamptz, add column deactivated_by uuid, add column deactivation_reason text;
alter table public.bookings add column if not exists active boolean not null default true;
alter table public.bookings add column deactivated_at timestamptz, add column deactivated_by uuid, add column deactivation_reason text;
alter table public.dumping_assignments add column if not exists active boolean not null default true;
alter table public.dumping_assignments add column deactivated_at timestamptz, add column deactivated_by uuid, add column deactivation_reason text;
alter table public.production_records add column if not exists active boolean not null default true;
alter table public.production_records add column deactivated_at timestamptz, add column deactivated_by uuid, add column deactivation_reason text;
alter table public.dumping_completions add column if not exists active boolean not null default true;
alter table public.dumping_completions add column deactivated_at timestamptz, add column deactivated_by uuid, add column deactivation_reason text;
alter table public.scan_assign_approvals add column if not exists active boolean not null default true;
alter table public.scan_assign_approvals add column deactivated_at timestamptz, add column deactivated_by uuid, add column deactivation_reason text;
alter table public.work_order_coaches add column if not exists active boolean not null default true;
alter table public.work_order_coaches add column deactivated_at timestamptz, add column deactivated_by uuid, add column deactivation_reason text;

-- No foreign key to auth.users for deactivated_by: retain the historical actor ID.
create function manufacturing_private.permanent_activity_guard() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if tg_op='DELETE' then raise exception 'Physical deletion is disabled. Deactivate this record instead.' using errcode='42501';end if;
 if tg_op='UPDATE' and not old.active then
  if new.active then raise exception 'Deactivation is permanent. Restoration is unavailable.' using errcode='42501';end if;
  if tg_table_name in ('production_records','dumping_completions','work_orders','sub_jobs','boxes','bookings','scan_assign_approvals','work_order_coaches') and new is distinct from old then
   raise exception 'Inactive records cannot be edited' using errcode='42501';end if;
  if tg_table_name='dumping_assignments' and (to_jsonb(new)-'last_scan_at') is distinct from (to_jsonb(old)-'last_scan_at') then raise exception 'Inactive assignments cannot be edited' using errcode='42501';end if;
  new.deactivated_at:=old.deactivated_at;new.deactivated_by:=old.deactivated_by;new.deactivation_reason:=old.deactivation_reason;
 elsif not new.active then
  new.deactivated_at:=clock_timestamp();new.deactivated_by:=auth.uid();
  new.deactivation_reason:=coalesce(nullif(trim(new.deactivation_reason),''),nullif(current_setting('bridges.deactivation_reason',true),''),'Assignment closed or removed from plan');
 elsif tg_op='INSERT' then
  new.deactivated_at:=null;new.deactivated_by:=null;new.deactivation_reason:=null;
 else
  new.deactivated_at:=old.deactivated_at;new.deactivated_by:=old.deactivated_by;new.deactivation_reason:=old.deactivation_reason;
 end if;
 return new;
end$$;
revoke all on function manufacturing_private.permanent_activity_guard() from public,anon,authenticated,service_role;
create trigger zz_permanent_activity before insert or update or delete on public.work_orders for each row execute function manufacturing_private.permanent_activity_guard();
create trigger zz_permanent_activity before insert or update or delete on public.sub_jobs for each row execute function manufacturing_private.permanent_activity_guard();
create trigger zz_permanent_activity before insert or update or delete on public.boxes for each row execute function manufacturing_private.permanent_activity_guard();
create trigger zz_permanent_activity before insert or update or delete on public.bookings for each row execute function manufacturing_private.permanent_activity_guard();
create trigger zz_permanent_activity before insert or update or delete on public.dumping_assignments for each row execute function manufacturing_private.permanent_activity_guard();
create trigger zz_permanent_activity before insert or update or delete on public.production_records for each row execute function manufacturing_private.permanent_activity_guard();
create trigger zz_permanent_activity before insert or update or delete on public.dumping_completions for each row execute function manufacturing_private.permanent_activity_guard();
create trigger zz_permanent_activity before insert or update or delete on public.scan_assign_approvals for each row execute function manufacturing_private.permanent_activity_guard();
create trigger zz_permanent_activity before insert or update or delete on public.work_order_coaches for each row execute function manufacturing_private.permanent_activity_guard();
create view manufacturing_private.active_work_orders with (security_invoker=true) as select * from public.work_orders where active;
revoke all on manufacturing_private.active_work_orders from public,anon,authenticated,service_role;
create view manufacturing_private.active_sub_jobs with (security_invoker=true) as select * from public.sub_jobs where active;
revoke all on manufacturing_private.active_sub_jobs from public,anon,authenticated,service_role;
create view manufacturing_private.active_boxes with (security_invoker=true) as select * from public.boxes where active;
revoke all on manufacturing_private.active_boxes from public,anon,authenticated,service_role;
create view manufacturing_private.active_bookings with (security_invoker=true) as select * from public.bookings where active;
revoke all on manufacturing_private.active_bookings from public,anon,authenticated,service_role;
create view manufacturing_private.active_production_records with (security_invoker=true) as select * from public.production_records where active;
revoke all on manufacturing_private.active_production_records from public,anon,authenticated,service_role;
create view manufacturing_private.active_dumping_completions with (security_invoker=true) as select * from public.dumping_completions where active;
revoke all on manufacturing_private.active_dumping_completions from public,anon,authenticated,service_role;
create view manufacturing_private.active_scan_assign_approvals with (security_invoker=true) as select * from public.scan_assign_approvals where active;
revoke all on manufacturing_private.active_scan_assign_approvals from public,anon,authenticated,service_role;

create function manufacturing_private.cascade_deactivation() returns trigger language plpgsql security definer set search_path='' as $$begin
 if old.active and not new.active then
  if tg_table_name='work_orders' then
   update public.sub_jobs set active=false,deactivation_reason=new.deactivation_reason where work_order_id=new.id and active;
   update public.bookings set active=false,deactivation_reason=new.deactivation_reason where work_order_id=new.id and active;
   update public.work_order_coaches set active=false,deactivation_reason=new.deactivation_reason where work_order_id=new.id and active;
  elsif tg_table_name='sub_jobs' then
   update public.boxes set active=false,deactivation_reason=new.deactivation_reason where sub_job_id=new.id and active;
   update public.dumping_assignments set active=false,deactivation_reason=new.deactivation_reason where sub_job_id=new.id and active;
   update public.scan_assign_approvals set active=false,deactivation_reason=new.deactivation_reason where sub_job_id=new.id and active;
  end if;
 end if;return null;
end$$;
revoke all on function manufacturing_private.cascade_deactivation() from public,anon,authenticated,service_role;
create trigger cascade_deactivation after update of active on public.work_orders for each row execute function manufacturing_private.cascade_deactivation();
create trigger cascade_deactivation after update of active on public.sub_jobs for each row execute function manufacturing_private.cascade_deactivation();

-- Prevent stale clients from inserting work under deactivated parents.
create function manufacturing_private.require_active_parent() returns trigger language plpgsql security definer set search_path='' as $$
declare parent text; key text; val text; ok boolean;begin
 parent:=tg_argv[0];key:=tg_argv[1];val:=to_jsonb(new)->>key;
 execute format('select active from public.%I where id::text=$1 for share',parent) into ok using val;
 if ok is distinct from true then raise exception 'The parent work or QR is inactive or unavailable' using errcode='PT409';end if;
 return new;
end$$;
revoke all on function manufacturing_private.require_active_parent() from public,anon,authenticated,service_role;
create trigger active_parent before insert or update of work_order_id on public.sub_jobs for each row execute function manufacturing_private.require_active_parent('work_orders','work_order_id');
create trigger active_parent before insert or update of sub_job_id on public.boxes for each row execute function manufacturing_private.require_active_parent('sub_jobs','sub_job_id');
create trigger active_parent before insert or update of sub_job_id on public.dumping_assignments for each row execute function manufacturing_private.require_active_parent('sub_jobs','sub_job_id');
create trigger active_parent before insert or update of sub_job_id on public.scan_assign_approvals for each row execute function manufacturing_private.require_active_parent('sub_jobs','sub_job_id');
create trigger active_parent before insert or update of work_order_id on public.bookings for each row execute function manufacturing_private.require_active_parent('work_orders','work_order_id');
create trigger active_parent before insert or update of box_id on public.production_records for each row execute function manufacturing_private.require_active_parent('boxes','box_id');
create trigger active_parent before insert or update of assignment_id on public.dumping_completions for each row execute function manufacturing_private.require_active_parent('dumping_assignments','assignment_id');

-- Block physical deletes at the remaining business roots, including cascades.
create function manufacturing_private.reject_business_delete() returns trigger language plpgsql set search_path='' as $$begin
 raise exception 'Business records must be retained; physical deletion is disabled' using errcode='42501';end$$;
revoke all on function manufacturing_private.reject_business_delete() from public,anon,authenticated,service_role;
do $$declare t text;begin
 foreach t in array array['orders','customers','customer_items','people','quality_checks','packing_checks','order_events','daily_attendance','individual_timesheets','plan_order_requests'] loop
 execute format('create trigger retain_business_record before delete on public.%I for each row execute function manufacturing_private.reject_business_delete()',t);
 end loop;
end$$;
-- No cascading removal of business records if a root is deleted by another integration.
do $$declare c record;begin
 for c in select conrelid::regclass tbl,conname,pg_get_constraintdef(oid) def from pg_constraint where contype='f' and confdeltype='c' and connamespace='public'::regnamespace and confrelid in ('public.orders'::regclass,'public.work_orders'::regclass,'public.customers'::regclass) loop
 execute format('alter table %s drop constraint %I',c.tbl,c.conname);
 execute format('alter table %s add constraint %I %s',c.tbl,c.conname,replace(c.def,'ON DELETE CASCADE','ON DELETE RESTRICT'));
 end loop;
end$$;

-- manufacturing_private.planned_jobs(date)
CREATE OR REPLACE FUNCTION manufacturing_private.planned_jobs(p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('admin','manager','coach','station','box_setup') then
  raise exception 'Plan access required' using errcode='42501';
 end if;
 if p_date is null or not isfinite(p_date) then raise exception 'Select a valid work date';end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object('unitEditState',manufacturing_private.plan_day_unit_state(j.id,p_date),'billableMode',o.total_billable_units is not null,'billableUnitsPerScan',w.billable_units_per_scan,'jobId',j.id,'jobName',j.data->>'name','orderId',o.id,
   'title',o.data->>'title','code',o.data->>'catalogCode','quantity',j.quantity,'completed',j.completed,
   'piecesToday',coalesce((select sum(records.pieces) from (
    select c.pieces from manufacturing_private.active_dumping_completions c join public.dumping_assignments d on d.id=c.assignment_id
     where d.sub_job_id=j.id and c.completed_at>=p_date::timestamp at time zone 'America/Chicago'
      and c.completed_at<(p_date+1)::timestamp at time zone 'America/Chicago'
    union all
    select r.completed_pieces from manufacturing_private.active_production_records r join manufacturing_private.active_boxes b on b.id=r.box_id
     where b.sub_job_id=j.id and r.completed_at>=p_date::timestamp at time zone 'America/Chicago'
      and r.completed_at<(p_date+1)::timestamp at time zone 'America/Chicago'
   ) records),0),
   'approvalId',a.id,'approvedAt',a.approved_at,
   'canComplete',a.id is not null and a.revoked_at is null and a.completed_at is null and j.completed<j.quantity and o.stage=1,
   'status',case when a.completed_at is not null or j.completed>=j.quantity then 'Completed'
     when a.revoked_at is not null then 'Revoked' when o.stage<>1 then 'Moved on'
     when a.id is not null then 'Ready for production' else 'Planned' end
  ) order by o.created_at desc,o.id,j.id)
  from manufacturing_private.active_sub_jobs j join manufacturing_private.active_work_orders w on w.id=j.work_order_id
  join public.orders o on o.id=w.order_id
  left join manufacturing_private.active_scan_assign_approvals a on a.sub_job_id=j.id and a.work_date=p_date
  where manufacturing_private.can_read_order(o.id)
   and (manufacturing_private.actor_role()<>'coach' or manufacturing_private.coach_can_manage_work(w.id))
   and (a.id is not null or exists(select 1 from public.dumping_assignments d
    where d.sub_job_id=j.id and d.work_date=p_date and (d.active or exists(select 1 from manufacturing_private.active_dumping_completions c where c.assignment_id=d.id))))
 ),'[]'::jsonb);
end $function$
;

-- manufacturing_private.read_order(text)
CREATE OR REPLACE FUNCTION manufacturing_private.read_order(p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$declare result jsonb;r text:=manufacturing_private.actor_role();begin
 if not manufacturing_private.can_read_order(p_id) then raise exception 'Order access denied' using errcode='42501';end if;
 select o.data||jsonb_build_object('totalBillableUnits',o.total_billable_units,'billableUnitsCompleted',(select coalesce(sum(s.billable_units_completed),0) from manufacturing_private.active_sub_jobs s join manufacturing_private.active_work_orders ww on ww.id=s.work_order_id where ww.order_id=o.id),'id',o.id,'stage',o.stage,'_revision',o.revision,'customer',case when r in ('station','box_setup','box_scanner') then 'Production' else c.name end,
 'workOrders',coalesce((select jsonb_agg(w.data||jsonb_build_object('billableUnitsPerScan',w.billable_units_per_scan,'id',w.id,'createdAt',w.created_at,'coachId',w.coach_id,'quantity',w.quantity,'perPack',w.pieces_per_pack,'scanCooldownSeconds',case when r in ('admin','manager') then coalesce(w.scan_cooldown_seconds,120) end,'scanPieces',case when r='admin' then w.scan_pieces end,'hasScans',case when r in ('admin','manager') then manufacturing_private.work_order_has_scans(w.id) else false end,
 'jobs',coalesce((select jsonb_agg(j.data||jsonb_build_object('totalBillableUnits',j.total_billable_units,'billableUnitsCompleted',j.billable_units_completed,'id',j.id,'quantity',j.quantity,'completed',j.completed) order by j.id) from manufacturing_private.active_sub_jobs j where j.work_order_id=w.id),'[]'),
 'boxes',coalesce((select jsonb_agg(b.data||jsonb_build_object('id',b.id,'jobId',b.sub_job_id,'personId',b.person_id,'quantity',b.quantity)||case when b.completed_at is not null then jsonb_build_object('completedAt',b.completed_at,'completedPieces',b.completed_pieces,'status','completed') else '{}'::jsonb end order by b.id) from manufacturing_private.active_boxes b join manufacturing_private.active_sub_jobs j on j.id=b.sub_job_id where j.work_order_id=w.id),'[]'),
 'audits',case when r in ('admin','manager') then coalesce((select jsonb_agg(q.data order by (q.data->>'at')::timestamptz,q.id) from public.quality_checks q where q.work_order_id=w.id),'[]') else '[]'::jsonb end,
 'packing',case when r in ('admin','manager') then coalesce((select jsonb_agg(q.data order by (q.data->>'at')::timestamptz,q.id) from public.packing_checks q where q.work_order_id=w.id),'[]') else '[]'::jsonb end) order by w.id) from manufacturing_private.active_work_orders w where w.order_id=o.id and (r<>'coach' or manufacturing_private.coach_can_manage_work(w.id))),'[]'),
 'history',case when r in ('admin','manager') then coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'message',e.message,'at',e.occurred_at) order by e.occurred_at,e.id) from public.order_events e where e.order_id=o.id),'[]') else '[]'::jsonb end) into result from public.orders o join public.customers c on c.id=o.customer_id where o.id=p_id;
 if r not in ('admin','manager') then result:=result-'delivery'-'warehouse'-'pictures'-'customer_snapshot'-'catalogRate';end if;
 return result;
end$function$
;

-- manufacturing_private.save_billable_scan_settings(text,integer,integer)
CREATE OR REPLACE FUNCTION manufacturing_private.save_billable_scan_settings(p_work text, p_seconds integer, p_units integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;begin
 perform manufacturing_private.require_admin_approvals();
 if p_units is null or not exists(select 1 from manufacturing_private.active_work_orders w join public.orders o on o.id=w.order_id where w.id=p_work and o.total_billable_units is not null) then raise exception 'Select a billable-unit work order and units per scan';end if;
 result:=manufacturing_private.save_scan_settings(p_work,p_seconds,p_units);
 update public.work_orders set billable_units_per_scan=p_units where id=p_work;
 update public.dumping_assignments a set batch_quantity=p_units from manufacturing_private.active_sub_jobs j where a.sub_job_id=j.id and j.work_order_id=p_work and a.active;
 update public.scan_assign_approvals a set pieces_per_scan=p_units from manufacturing_private.active_sub_jobs j where a.sub_job_id=j.id and j.work_order_id=p_work and a.completed_at is null and a.revoked_at is null;
 return result||jsonb_build_object('billableUnitsPerScan',p_units);
end $function$
;

-- manufacturing_private.scan_billable_units(text,text,uuid,integer,integer)
CREATE OR REPLACE FUNCTION manufacturing_private.scan_billable_units(p_code text, p_assignment text, p_request uuid, p_units integer, p_expected_load integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare receipt jsonb; row public.dumping_completions;
begin
 if p_code like 'IND-%' then receipt:=manufacturing_private.scan_individual_job_qr(p_code,p_assignment,p_request,p_units,p_expected_load);
 else receipt:=manufacturing_private.scan_reusable_configured(p_code,p_request,p_units,p_expected_load);end if;
 select * into row from manufacturing_private.active_dumping_completions where id=(receipt->>'eventId')::uuid;
 return receipt||jsonb_build_object('billableUnits',row.billable_units,'billableMode',row.billable_units is not null,'unitLabel',row.billable_unit_label);
end $function$
;

-- manufacturing_private.billable_unit_report(date,date,integer)
CREATE OR REPLACE FUNCTION manufacturing_private.billable_unit_report(p_start date, p_end date, p_offset integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('accounts','admin','manager') then raise exception 'Accounts access required' using errcode='42501';end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<p_start or p_end-p_start>366 or p_offset is null or p_offset not between 0 and 1000000 then raise exception 'Select a date range of up to one year';end if;
 with scans as (
 select a.person_id,a.sub_job_id,c.completed_at,c.billable_units,c.billing_rate_snapshot,c.pay_rate_snapshot,c.billable_unit_label from manufacturing_private.active_dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id where c.billable_units is not null
 union all
 select b.person_id,b.sub_job_id,r.completed_at,r.billable_units,r.billing_rate_snapshot,r.pay_rate_snapshot,r.billable_unit_label from manufacturing_private.active_production_records r join manufacturing_private.active_boxes b on b.id=r.box_id where r.billable_units is not null
 ), grouped as (
 select c.name client,o.id order_id,o.data->>'catalogCode' item_code,o.data->>'title' item,p.name individual,s.billable_unit_label unit,
 sum(s.billable_units) units,count(*) scans,
 case when count(*) filter(where s.billing_rate_snapshot is null)=0 then round(sum(s.billable_units*s.billing_rate_snapshot),2) end client_payment,
 case when count(*) filter(where s.pay_rate_snapshot is null)=0 then round(sum(s.billable_units*s.pay_rate_snapshot),2) end individual_pay
 from scans s join public.people p on p.id=s.person_id join manufacturing_private.active_sub_jobs j on j.id=s.sub_job_id join manufacturing_private.active_work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id join public.customers c on c.id=o.customer_id
 where s.completed_at>=p_start::timestamp at time zone 'America/Chicago' and s.completed_at<(p_end+1)::timestamp at time zone 'America/Chicago'
 group by c.name,o.id,p.id,s.billable_unit_label
 ) select jsonb_build_object('total',count(*),'units',coalesce(sum(units),0),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from (select * from grouped order by client,item_code,individual,order_id limit 50 offset p_offset) page),'[]')) into result from grouped;
 return result;
end $function$
;

-- manufacturing_private.plan_day_unit_state(text,date)
CREATE OR REPLACE FUNCTION manufacturing_private.plan_day_unit_state(p_job text, p_date date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with bounds as(select p_date::timestamp at time zone 'America/Chicago' lo,(p_date+1)::timestamp at time zone 'America/Chicago' hi),
 scans as(
  select c.id,c.billable_units,c.completed_at,'reusable' kind from manufacturing_private.active_dumping_completions c
   join public.dumping_assignments d on d.id=c.assignment_id cross join bounds t
   where d.sub_job_id=p_job and c.completed_at>=t.lo and c.completed_at<t.hi
  union all
  select r.id,r.billable_units,r.completed_at,'box' from manufacturing_private.active_production_records r
   join manufacturing_private.active_boxes b on b.id=r.box_id cross join bounds t
   where b.sub_job_id=p_job and r.completed_at>=t.lo and r.completed_at<t.hi
 ), stats as(
  select count(*) scan_count,coalesce(sum(billable_units),0) units,
   count(*) filter(where billable_units is null)>0 unclassified,
   md5(coalesce(string_agg(kind||':'||id::text||':'||coalesce(billable_units::text,'null')||':'||extract(epoch from completed_at)::text,'|' order by kind,id),'')) fingerprint from scans
 ), state as(
  select j.total_billable_units,w.billable_units_per_scan,o.revision,
   (o.total_billable_units is not null and j.total_billable_units is not null) billable,
   (o.stage=1 and a.id is not null and a.revoked_at is null and a.completed_at is null) active,
   (select count(*)=1 from manufacturing_private.active_sub_jobs sibling where sibling.work_order_id=w.id) single_job,
   s.*,
   exists(select 1 from manufacturing_private.active_production_records r join manufacturing_private.active_boxes b on b.id=r.box_id cross join bounds t
     where b.sub_job_id=j.id and r.completed_at>=t.lo and r.completed_at<t.hi
      and (b.completed_at is null or b.completed_at<t.lo or b.completed_at>=t.hi
       or exists(select 1 from manufacturing_private.active_production_records other where other.box_id=b.id and (other.completed_at<t.lo or other.completed_at>=t.hi)))) mixed_box_dates
  from manufacturing_private.active_sub_jobs j join manufacturing_private.active_work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id
  left join manufacturing_private.active_scan_assign_approvals a on a.sub_job_id=j.id and a.work_date=p_date cross join stats s where j.id=p_job
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
$function$
;

-- manufacturing_private.edit_plan_day_units(text,date,integer,boolean,bigint,text,uuid)
CREATE OR REPLACE FUNCTION manufacturing_private.edit_plan_day_units(p_job text, p_date date, p_units integer, p_reset boolean, p_revision bigint, p_fingerprint text, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 select w.order_id,w.id into oid,wid from manufacturing_private.active_sub_jobs j join manufacturing_private.active_work_orders w on w.id=j.work_order_id where j.id=p_job;
 if oid is null then raise exception 'The planned job no longer exists';end if;
 perform 1 from public.orders where id=oid for update;
 perform 1 from manufacturing_private.active_sub_jobs where id=p_job for update;
 state:=manufacturing_private.plan_day_unit_state(p_job,p_date);
 if (state->>'revision')::bigint is distinct from p_revision or state->>'scanFingerprint' is distinct from p_fingerprint then raise exception 'Production changed. Refresh the planned day and review before saving.' using errcode='PT409';end if;
 if not coalesce((state->>'canEditUnits')::boolean,false) then raise exception '%',coalesce(state->>'unitEditReason','This plan cannot be changed');end if;
 if p_units>(state->>'totalBillableUnits')::integer then raise exception 'BU/Scan cannot exceed total billable units';end if;
 if (state->>'dayScanCount')::integer>0 and not p_reset then raise exception 'Confirm reset of this selected day before changing BU/Scan';end if;
 lo:=p_date::timestamp at time zone 'America/Chicago';hi:=(p_date+1)::timestamp at time zone 'America/Chicago';
 select jsonb_build_object(
  'reusable',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from manufacturing_private.active_dumping_completions c join public.dumping_assignments d on d.id=c.assignment_id where d.sub_job_id=p_job and c.completed_at>=lo and c.completed_at<hi),'[]'),
  'singleUse',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from manufacturing_private.active_production_records r join manufacturing_private.active_boxes b on b.id=r.box_id where b.sub_job_id=p_job and r.completed_at>=lo and r.completed_at<hi),'[]'),
  'boxBookings',coalesce((select jsonb_agg(to_jsonb(bk) order by bk.id) from manufacturing_private.active_bookings bk join manufacturing_private.active_boxes b on b.id=bk.id where b.sub_job_id=p_job and bk.starts_on=p_date and bk.ends_on=p_date and exists(select 1 from manufacturing_private.active_production_records r where r.box_id=b.id and r.completed_at>=lo and r.completed_at<hi)),'[]'),
  'boxes',coalesce((select jsonb_agg(to_jsonb(b) order by b.id) from manufacturing_private.active_boxes b where b.sub_job_id=p_job and exists(select 1 from manufacturing_private.active_production_records r where r.box_id=b.id and r.completed_at>=lo and r.completed_at<hi)),'[]')) into archived;
 select coalesce(array_agg((x->>'id')::uuid),'{}'::uuid[]) into ids from jsonb_array_elements((archived->'reusable')||(archived->'singleUse')) x;
 removed:=case when p_reset then (state->>'dayBillableUnits')::integer else 0 end;
 receipt:=jsonb_build_object('jobId',p_job,'date',p_date,'unitsPerScan',p_units,'removedUnits',removed,
  'removedScans',case when p_reset then (state->>'dayScanCount')::integer else 0 end,'duplicate',false);
 insert into manufacturing_private.plan_day_unit_changes(request_id,actor_id,job_id,work_date,old_units_per_scan,new_units_per_scan,reset_requested,scan_ids,snapshot,result)
 values(p_request,auth.uid(),p_job,p_date,(state->>'billableUnitsPerScan')::integer,p_units,p_reset,ids,archived,receipt);
 if p_reset then
  update public.dumping_completions c set active=false,deactivation_reason='Admin reset of selected planned day' from public.dumping_assignments d where c.assignment_id=d.id and d.sub_job_id=p_job and c.completed_at>=lo and c.completed_at<hi and c.active;
  update public.production_records r set active=false,deactivation_reason='Admin reset of selected planned day' from manufacturing_private.active_boxes b where r.box_id=b.id and b.sub_job_id=p_job and r.completed_at>=lo and r.completed_at<hi and r.active;
  update public.bookings bk set active=false,deactivation_reason='Admin reset of selected planned day' where bk.active and bk.id in (select x->>'id' from jsonb_array_elements(archived->'boxBookings') x);
  -- Retire completed single-use labels; they must not be replayed after reset.
  update public.boxes b set active=false,deactivation_reason='Admin reset of selected planned day' where b.active and b.id in (select x->>'id' from jsonb_array_elements(archived->'boxes') x);
  update public.sub_jobs set completed=completed-removed where id=p_job;
  update public.dumping_assignments d set last_scan_at=(select max(c.completed_at) from manufacturing_private.active_dumping_completions c where c.assignment_id=d.id) where d.sub_job_id=p_job;
 end if;
 -- BU/Scan is a work-order setting, shared with its active assignments; the
 -- scan removal above is strictly limited to this job on the selected day.
 perform manufacturing_private.save_billable_scan_settings(wid,(select scan_cooldown_seconds from manufacturing_private.active_work_orders where id=wid),p_units);
 update public.orders set revision=revision+1,updated_at=clock_timestamp() where id=oid;
 insert into public.order_events(order_id,actor_id,message) values(oid,auth.uid(),format('Admin updated BU/Scan to %s for %s. Reset selected day %s: %s scans / %s BU removed; other days preserved.',p_units,p_job,p_date,receipt->>'removedScans',removed));
 return receipt;
end $function$
;

-- manufacturing_private.scanner_daily_work(date)
CREATE OR REPLACE FUNCTION manufacturing_private.scanner_daily_work(p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or manufacturing_private.actor_role() not in ('admin','manager','coach','station','box_scanner') or manufacturing_private.actor_role() is null then raise exception 'Scanner access required' using errcode='42501';end if;
 if p_date is null then raise exception 'Select a day';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('personId',person_id,'name',name,'billableUnits',billable_units,'pieces',pieces,'completions',completions) order by pieces desc,name,person_id) from (
 select e.person_id,p.name,sum(e.pieces) pieces,coalesce(sum(e.billable_units),0) billable_units,count(*) completions from (
 select b.person_id,b.completed_pieces pieces,(select coalesce(sum(r.billable_units),0) from manufacturing_private.active_production_records r where r.box_id=b.id) billable_units,w.order_id from manufacturing_private.active_boxes b join manufacturing_private.active_sub_jobs j on j.id=b.sub_job_id join manufacturing_private.active_work_orders w on w.id=j.work_order_id
 where b.completed_at >= (p_date::timestamp at time zone 'America/Chicago') and b.completed_at < ((p_date+1)::timestamp at time zone 'America/Chicago')
 union all
 select a.person_id,c.pieces,c.billable_units,w.order_id from manufacturing_private.active_dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id join manufacturing_private.active_work_orders w on w.id=j.work_order_id
 where c.completed_at >= (p_date::timestamp at time zone 'America/Chicago') and c.completed_at < ((p_date+1)::timestamp at time zone 'America/Chicago')
 ) e join public.people p on p.id=e.person_id where manufacturing_private.can_read_order(e.order_id)
 and (manufacturing_private.actor_role()<>'coach' or exists(select 1 from manufacturing_private.active_work_orders w where w.order_id=e.order_id and manufacturing_private.coach_can_manage_work(w.id)))
 group by e.person_id,p.name) totals),'[]'::jsonb);
end$function$
;

-- manufacturing_private.scan_and_assign(uuid,text)
CREATE OR REPLACE FUNCTION manufacturing_private.scan_and_assign(p_approval uuid, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 r text:=manufacturing_private.actor_role(); a public.scan_assign_approvals;
 person public.people; assignment public.dumping_assignments; j public.sub_jobs;
 previous_ids text[];
 oid text; today date:=(clock_timestamp() at time zone 'America/Chicago')::date;
begin
 if auth.uid() is null or coalesce(r,'') not in ('admin','manager','coach','station','box_setup','box_scanner') then
   raise exception 'Shop Floor access required' using errcode='42501';
 end if;
 select work_row.order_id into oid from manufacturing_private.active_scan_assign_approvals approval_row
 join manufacturing_private.active_sub_jobs job_row on job_row.id=approval_row.sub_job_id
 join manufacturing_private.active_work_orders work_row on work_row.id=job_row.work_order_id where approval_row.id=p_approval;
 if oid is null then raise exception 'Choose an approved Scan & Assign order'; end if;
 perform 1 from public.orders where id=oid and stage=1 for update;
 if not found then raise exception 'This order is no longer in production'; end if;
 select * into a from manufacturing_private.active_scan_assign_approvals where id=p_approval and revoked_at is null and work_date=today for update;
 if not found then raise exception 'This Scan & Assign approval is no longer active for today'; end if;
 perform manufacturing_private.dumping_access(a.sub_job_id,r='box_setup');
 perform pg_advisory_xact_lock(hashtextextended('day-plan:'||today::text,0));
 select * into person from public.people where job_qr_code=upper(trim(p_code)) and kind='individual' for update;
 if person.id is null then raise exception 'Scan a system-generated Individual Job QR card'; end if;
 if person.data->>'active'='false' or person.job_qr_expires_on<today then raise exception 'This individual is disabled or their QR card has expired'; end if;
 select * into j from manufacturing_private.active_sub_jobs where id=a.sub_job_id for update;
 if j.completed>=j.quantity then raise exception 'This sub-job is already complete'; end if;
 select * into assignment from public.dumping_assignments
 where scan_assign_approval_id=a.id and person_id=person.id and active for update;
 if assignment.id is null then
   -- Move the personal card to this job; retain all earlier labels and production.
   -- Future plans and unfinished single-use boxes remain available independently.
   with previous as (
     update public.dumping_assignments set active=false
     where person_id=person.id and active and (work_date is null or work_date<=today)
     returning id
   ) select coalesce(array_agg(id),'{}'::text[]) into previous_ids from previous;
   insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,work_date,created_by,
     plan_id,plan_approved_at,personal_qr,scan_assign_approval_id,scan_assign_ready_at)
   values('REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),j.id,person.id,a.pieces_per_scan,today,auth.uid(),
     a.id,now(),true,a.id,clock_timestamp()+interval '1 minute')
   returning * into assignment;
   update public.orders set revision=revision+1,updated_at=now() where id=oid;
   insert into public.order_events(order_id,actor_id,message)
   values(oid,auth.uid(),format('Scan & Assign: %s assigned to %s; production unlocks in one minute.%s',person.name,j.id,
     case when cardinality(previous_ids)>0 then ' Previous assignments released: '||array_to_string(previous_ids,', ')||'. Production history retained.' else '' end));
 end if;
 return jsonb_build_object('assignmentId',assignment.id,'personName',person.name,'piecesPerScan',assignment.batch_quantity,
   'reassigned',coalesce(cardinality(previous_ids),0)>0,
   'readyAt',assignment.scan_assign_ready_at,
   'waitSeconds',greatest(0,ceil(extract(epoch from assignment.scan_assign_ready_at-clock_timestamp()))));
end $function$
;

-- manufacturing_private.set_qr_daily_total(text,text,date,integer,integer,uuid)
CREATE OR REPLACE FUNCTION manufacturing_private.set_qr_daily_total(p_code text, p_target text, p_date date, p_total integer, p_expected integer, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 code text:=upper(trim(p_code)); summary jsonb; receipt public.admin_qr_daily_totals;
 delta integer; event uuid; result jsonb; now_at timestamptz;
begin
 perform manufacturing_private.require_admin_approvals();
 if p_request is null or p_total is null or p_total not between 0 and 1000000 or p_expected is null then
  raise exception 'Enter a valid daily pieces total';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('admin-qr-total:'||p_request::text,0));
 select * into receipt from public.admin_qr_daily_totals where request_id=p_request;
 if receipt.request_id is not null then
  if receipt.actor_id<>auth.uid() or receipt.qr_code is distinct from code or receipt.target_id is distinct from p_target
    or receipt.work_date is distinct from p_date or receipt.total<>p_total then
   raise exception 'This production request reference is already used';
  end if;
  return receipt.result||jsonb_build_object('duplicate',true);
 end if;
 if p_date is distinct from (clock_timestamp() at time zone 'America/Chicago')::date then
  raise exception 'The day changed. Refresh the daily total before saving.' using errcode='PT409';
 end if;
 select row into summary from jsonb_array_elements(manufacturing_private.admin_qr_daily_summary(code)) row
  where row->>'id'=p_target;
 if summary is null then raise exception 'Scan a QR assigned to work for today'; end if;
 perform 1 from public.orders where id=summary->>'orderId' for update;
 perform 1 from public.people where id=summary->>'personId' for update;
 perform 1 from manufacturing_private.active_sub_jobs where id=summary->>'jobId' for update;
 if summary->>'kind'='box' then
  perform 1 from manufacturing_private.active_boxes where id=p_target for update;
 else
  perform 1 from public.dumping_assignments where id=p_target for update;
 end if;
 select row into summary from jsonb_array_elements(manufacturing_private.admin_qr_daily_summary(code)) row
  where row->>'id'=p_target;
 if summary is null or (summary->>'recorded')::integer<>p_expected then
  raise exception 'Production changed. Refresh the daily total and review again.' using errcode='PT409';
 end if;
 if p_total<p_expected or p_total>(summary->>'maxTotal')::integer then
  raise exception 'Enter a total from % to % pieces.',p_expected,summary->>'maxTotal';
 end if;
 delta:=p_total-p_expected;
 now_at:=clock_timestamp();
 if delta>0 then
  if summary->>'kind'='box' then
   update public.boxes set completed_pieces=p_total,completed_at=coalesce(completed_at,now_at) where id=p_target;
   insert into public.production_records(box_id,completed_pieces,actor_id,completed_at)
    values(p_target,p_total,auth.uid(),now_at)
    on conflict(box_id) do update set completed_pieces=excluded.completed_pieces returning id into event;
  else
   event:=p_request;
   insert into public.dumping_completions(id,assignment_id,pieces,actor_id,completed_at)
    values(event,p_target,delta,auth.uid(),now_at);
   update public.dumping_assignments set last_scan_at=now_at where id=p_target;
  end if;
  update public.sub_jobs set completed=completed+delta where id=summary->>'jobId';
  update public.orders set revision=revision+1,updated_at=now_at where id=summary->>'orderId';
  insert into public.order_events(order_id,actor_id,message) values(summary->>'orderId',auth.uid(),
   format('Admin daily total for %s (%s), QR %s on %s: %s pieces, %s previously recorded, %s added.',
    summary->>'personName',summary->>'jobName',code,p_date,p_total,p_expected,delta));
 end if;
 result:=jsonb_build_object('personId',summary->>'personId','personName',summary->>'personName',
   'total',p_total,'added',delta,'date',p_date,'eventId',event,'duplicate',false);
 insert into public.admin_qr_daily_totals(request_id,actor_id,qr_code,target_id,work_date,total,added,event_id,result)
 values(p_request,auth.uid(),code,p_target,p_date,p_total,delta,event,result);
 return result;
end $function$
;

-- manufacturing_private.shop_floor_dashboard(date)
CREATE OR REPLACE FUNCTION manufacturing_private.shop_floor_dashboard(p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r text:=manufacturing_private.actor_role();
begin
 if auth.uid() is null or coalesce(r,'') not in ('admin','manager','coach','station','box_setup','box_scanner') then
   raise exception 'Shop Floor access required' using errcode='42501';
 end if;
 if p_date is null or not isfinite(p_date) then raise exception 'Choose a valid date'; end if;
 return (
   with accessible_work as (
     select w.id,w.order_id from manufacturing_private.active_work_orders w
     where manufacturing_private.can_read_order(w.order_id)
       and (r<>'coach' or manufacturing_private.coach_can_manage_work(w.id))
   ), scanned as (
     select w.order_id,records.completed_pieces as pieces
     from manufacturing_private.active_production_records records join manufacturing_private.active_boxes b on b.id=records.box_id
     join manufacturing_private.active_sub_jobs j on j.id=b.sub_job_id join accessible_work w on w.id=j.work_order_id
     where records.completed_at>=(p_date::timestamp at time zone 'America/Chicago')
       and records.completed_at<((p_date+1)::timestamp at time zone 'America/Chicago')
       and not exists(select 1 from public.barcode_approval_batches approval
         where approval.actor_id=records.actor_id and approval.created_at=records.completed_at
           and approval.kind='box' and b.id=any(approval.ids))
     union all
     select w.order_id,c.pieces
     from manufacturing_private.active_dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id
     join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id join accessible_work w on w.id=j.work_order_id
     where c.completed_at>=(p_date::timestamp at time zone 'America/Chicago')
       and c.completed_at<((p_date+1)::timestamp at time zone 'America/Chicago')
   ), totals as (
     select order_id,sum(pieces) as pieces from scanned group by order_id
   ), eligible as (
     select order_id from totals
     union
     select w.order_id from manufacturing_private.active_scan_assign_approvals a
       join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id join accessible_work w on w.id=j.work_order_id
       join public.orders o on o.id=w.order_id
     where a.work_date=p_date and a.revoked_at is null and o.stage=1
     union
     select w.order_id from public.dumping_assignments a
       join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id join accessible_work w on w.id=j.work_order_id
       join public.orders o on o.id=w.order_id
     where a.work_date=p_date and a.active and a.plan_approved_at is not null and o.stage=1
   )
   select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'title',o.data->>'title',
     'billableMode',o.total_billable_units is not null,'code',o.data->>'catalogCode','pieces',coalesce(t.pieces,0))
     order by coalesce(t.pieces,0) desc,o.data->>'title',o.id),'[]'::jsonb)
   from eligible e join public.orders o on o.id=e.order_id
   left join totals t on t.order_id=o.id
 );
end $function$
;

-- manufacturing_private.admin_qr_daily_summary(text)
CREATE OR REPLACE FUNCTION manufacturing_private.admin_qr_daily_summary(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 code text:=upper(trim(p_code));
 today date:=(statement_timestamp() at time zone 'America/Chicago')::date;
begin
 perform manufacturing_private.require_admin_approvals();
 return (
  with candidates as (
   select a.id,'reusable'::text as kind,a.person_id,a.sub_job_id,null::integer as quantity,
    null::timestamptz as completed_at,a.active,a.created_at,
    row_number() over(partition by a.sub_job_id order by a.active desc,a.created_at desc,a.id) as job_rank
   from public.dumping_assignments a join public.people p on p.id=a.person_id
   where (a.id=code or p.job_qr_code=code)
    and (a.work_date is null or a.work_date=today or exists(
     select 1 from manufacturing_private.active_dumping_completions c where c.assignment_id=a.id
      and c.completed_at>=today::timestamp at time zone 'America/Chicago'
      and c.completed_at<(today+1)::timestamp at time zone 'America/Chicago'))
   union all
   select b.id,'box',b.person_id,b.sub_job_id,b.quantity,b.completed_at,false,b.created_at,1
   from manufacturing_private.active_boxes b where b.id=code
  ), targets as (
   select c.*,j.quantity as job_quantity,j.completed as job_completed,w.order_id,
    o.stage,o.data->>'title' as title,o.data->>'catalogCode' as catalog_code,j.data->>'name' as job_name,
    p.name,
    case when c.kind='box' then (
     select coalesce(b.completed_pieces,0) from manufacturing_private.active_boxes b where b.id=c.id
       and b.completed_at>=today::timestamp at time zone 'America/Chicago'
       and b.completed_at<(today+1)::timestamp at time zone 'America/Chicago')
    else (
     select sum(dc.pieces) from manufacturing_private.active_dumping_completions dc
      join public.dumping_assignments da on da.id=dc.assignment_id
     where (da.id=c.id or (code like 'IND-%' and da.person_id=c.person_id and da.sub_job_id=c.sub_job_id))
      and dc.completed_at>=today::timestamp at time zone 'America/Chicago'
      and dc.completed_at<(today+1)::timestamp at time zone 'America/Chicago')
    end as recorded,
    (select coalesce(sum(b.quantity),0) from manufacturing_private.active_boxes b
      where b.sub_job_id=c.sub_job_id and b.completed_at is null
       and (c.kind<>'box' or b.id<>c.id)) as reserved
   from candidates c join manufacturing_private.active_sub_jobs j on j.id=c.sub_job_id
   join manufacturing_private.active_work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id
   join public.people p on p.id=c.person_id
   where code not like 'IND-%' or c.job_rank=1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
   'id',id,'kind',kind,'personId',person_id,'personName',name,'jobId',sub_job_id,
   'orderId',order_id,'orderTitle',title,'orderCode',catalog_code,'jobName',job_name,'date',today,
   'recorded',coalesce(recorded,0),
   'maxTotal',case when kind='box' and completed_at is not null
      and (completed_at at time zone 'America/Chicago')::date<>today then 0
    when kind='box' then least(quantity,coalesce(recorded,0)+case when stage=1 then greatest(0,job_quantity-job_completed-reserved) else 0 end)
    else coalesce(recorded,0)+case when stage=1 then greatest(0,job_quantity-job_completed-reserved) else 0 end end
  ) order by active desc,created_at desc,id),'[]'::jsonb) from targets
 );
end $function$
;

-- manufacturing_private.coach_can_manage_work(text)
CREATE OR REPLACE FUNCTION manufacturing_private.coach_can_manage_work(p_work text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.staff_profiles s join public.people p on p.id=s.person_id
 join manufacturing_private.active_work_orders w on w.id=p_work
 where s.id=auth.uid() and s.active and s.role='coach' and p.kind='coach'
 and p.data->>'active' is distinct from 'false'
 and (w.coach_id=p.id or exists(select 1 from public.work_order_coaches c where c.work_order_id=w.id and c.person_id=p.id)));
$function$
;

-- manufacturing_private.create_box(text,text,jsonb)
CREATE OR REPLACE FUNCTION manufacturing_private.create_box(p_order_id text, p_work_id text, p_box jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare o public.orders;w public.work_orders;j public.sub_jobs;pending integer;qty integer:=(p_box->>'quantity')::integer;hours numeric;r text:=manufacturing_private.actor_role();begin
 if auth.uid() is null or r is null then raise exception 'Staff access required' using errcode='42501';end if;
 if r not in ('admin','manager','coach','station','box_setup') then raise exception 'Box setup access required' using errcode='42501';end if;
 select * into o from public.orders where id=p_order_id for update;select * into w from manufacturing_private.active_work_orders where id=p_work_id and order_id=o.id;select * into j from manufacturing_private.active_sub_jobs where id=p_box->>'jobId' and work_order_id=w.id;
 if o.stage<>1 or w.id is null or j.id is null then raise exception 'Choose an order in production and a valid sub-job';end if;
 if r='coach' and not manufacturing_private.coach_can_manage_work(w.id) then raise exception 'Work order is not assigned to you' using errcode='42501';end if;
 if not exists(select 1 from public.people where id=p_box->>'personId' and kind='individual') then raise exception 'Select a valid individual';end if;
 perform manufacturing_private.require_person_free(p_box->>'personId'); if extract(isodow from (p_box->>'date')::date)>5 then raise exception 'Choose a working day';end if;
 select coalesce(sum(quantity),0) into pending from manufacturing_private.active_boxes where sub_job_id=j.id and completed_at is null;
 if qty<1 or qty+j.completed+pending>j.quantity then raise exception 'Box exceeds unallocated sub-job quantity';end if;
 hours:=(qty*coalesce((w.data->>'seconds')::numeric,30)+ceil(qty::numeric/w.pieces_per_pack)*coalesce((w.data->>'packSeconds')::numeric,0))/3600;
 insert into public.boxes(id,sub_job_id,person_id,quantity,data) values(p_box->>'id',j.id,p_box->>'personId',qty,p_box||jsonb_build_object('createdAt',now(),'coachId',w.coach_id));
 insert into public.bookings(id,person_id,order_id,work_order_id,starts_on,ends_on,hours,data) values(p_box->>'id',p_box->>'personId',o.id,w.id,(p_box->>'date')::date,(p_box->>'date')::date,hours,jsonb_build_object('notes','Box assignment'));
 update public.orders set revision=revision+1,updated_at=now() where id=o.id;
 insert into public.order_events(order_id,actor_id,message) values(o.id,auth.uid(),'Box '||(p_box->>'id')||' created and assigned.');return manufacturing_private.workspace();end$function$
;

-- manufacturing_private.scan_assign_approvals(date)
CREATE OR REPLACE FUNCTION manufacturing_private.scan_assign_approvals(p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r text:=manufacturing_private.actor_role();
begin
 if auth.uid() is null or coalesce(r,'') not in ('admin','manager','coach','station','box_setup','box_scanner') then
   raise exception 'Shop Floor access required' using errcode='42501';
 end if;
 if p_date is null or not isfinite(p_date) then raise exception 'Choose a valid work date'; end if;
 return coalesce((
   select jsonb_agg(jsonb_build_object('id',a.id,'jobId',j.id,'jobName',j.data->>'name',
     'orderId',o.id,'orderTitle',o.data->>'title','orderCode',o.data->>'catalogCode',
     'workDate',a.work_date,'approvedAt',a.approved_at,'piecesPerScan',a.pieces_per_scan,
     'assigned',(select count(*) from public.dumping_assignments d where d.scan_assign_approval_id=a.id and d.active))
     order by o.id,j.id)
   from manufacturing_private.active_scan_assign_approvals a join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id
   join manufacturing_private.active_work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id
   where a.work_date=p_date and a.revoked_at is null and o.stage=1 and j.completed<j.quantity
     and manufacturing_private.can_read_order(o.id)
     and (r<>'coach' or manufacturing_private.coach_can_manage_work(w.id))
 ),'[]'::jsonb);
end $function$
;

-- manufacturing_private.complete_scan_assign(uuid,date,timestamp with time zone)
CREATE OR REPLACE FUNCTION manufacturing_private.complete_scan_assign(p_approval uuid, p_date date, p_approved_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare approval public.scan_assign_approvals; oid text; closed integer;
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('admin','manager','coach','station','box_setup') then
  raise exception 'Plan approval access required' using errcode='42501';
 end if;
 select w.order_id into oid from manufacturing_private.active_scan_assign_approvals a join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id
 join manufacturing_private.active_work_orders w on w.id=j.work_order_id where a.id=p_approval;
 if oid is null then raise exception 'Select an existing Scan & Assign approval';end if;
 perform 1 from public.orders where id=oid for update;
 select * into approval from manufacturing_private.active_scan_assign_approvals where id=p_approval for update;
 perform manufacturing_private.dumping_access(approval.sub_job_id,true);
 if p_date is distinct from approval.work_date or p_approved_at is distinct from approval.approved_at then
  raise exception 'This approval changed. Refresh and review it before marking complete.' using errcode='PT409';
 end if;
 if approval.completed_at is null then
  update public.scan_assign_approvals set completed_at=clock_timestamp(),completed_by=auth.uid(),
   revoked_at=coalesce(revoked_at,clock_timestamp()) where id=approval.id;
  update public.dumping_assignments set active=false where scan_assign_approval_id=approval.id and active;
  get diagnostics closed=row_count;
  update public.orders set revision=revision+1,updated_at=clock_timestamp() where id=oid;
  insert into public.order_events(order_id,actor_id,message) values(oid,auth.uid(),
   format('Scan & Assign marked complete for %s on %s. Removed from Shop Floor; %s assignments closed. Recorded production retained.',approval.sub_job_id,approval.work_date,closed));
 end if;
 return manufacturing_private.scan_assign_approvals(approval.work_date);
end $function$
;

-- manufacturing_private.day_plan_has_scans(text,date,uuid)
CREATE OR REPLACE FUNCTION manufacturing_private.day_plan_has_scans(p_job text, p_date date, p_plan uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select exists (
   select 1 from public.dumping_assignments a
   join manufacturing_private.active_dumping_completions c on c.assignment_id=a.id
   where a.sub_job_id=p_job and a.work_date=p_date and a.plan_id is not distinct from p_plan
 );
$function$
;

-- manufacturing_private.discard_work_order(text,text,bigint)
CREATE OR REPLACE FUNCTION manufacturing_private.discard_work_order(p_order text, p_work text, p_revision bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 current_order public.orders;
 target public.work_orders;
 next_expected text;
begin
 perform manufacturing_private.require_manager();
 perform pg_advisory_xact_lock(hashtextextended(p_order,0));
 select * into current_order from public.orders where id=p_order for update;
 if current_order.id is null then raise exception 'Order no longer exists'; end if;
 if current_order.revision is distinct from p_revision then
   raise exception 'This order changed on another device. Refresh and retry.' using errcode='PT409';
 end if;
 select * into target from manufacturing_private.active_work_orders where id=p_work and order_id=p_order for update;
 if target.id is null then raise exception 'Work order no longer exists'; end if;
 if current_order.stage not in (0,1) or manufacturing_private.work_order_has_scans(p_work)
   or exists(select 1 from manufacturing_private.active_sub_jobs where work_order_id=p_work and completed>0)
   or exists(select 1 from public.quality_checks where work_order_id=p_work)
   or exists(select 1 from public.packing_checks where work_order_id=p_work)
   or exists(select 1 from manufacturing_private.active_bookings where work_order_id=p_work and status='completed')
 then raise exception 'Work has been recorded. This work order cannot be discarded.'; end if;

 -- Removing an allocation requires the order to be re-approved. Protect any
 -- sibling work already underway from being sent back to planning.
 if exists (
   select 1 from manufacturing_private.active_work_orders w where w.order_id=p_order and w.id<>p_work and (
     manufacturing_private.work_order_has_scans(w.id)
     or exists(select 1 from manufacturing_private.active_sub_jobs j where j.work_order_id=w.id and j.completed>0)
   )
 ) then raise exception 'Other work on this order has started. Its production allocation cannot be reopened.'; end if;

 
 
 
 update public.work_orders set active=false,deactivation_reason='Unstarted work order deactivated' where id=p_work and active;

 select max(nullif(data->>'expected','')) into next_expected from manufacturing_private.active_work_orders where order_id=p_order;
 update public.orders set stage=0,revision=revision+1,updated_at=now(),
   data=(data-'workOrderApprovedAt'-'assignmentConfirmedAt'-'productionStartedAt')||
     jsonb_build_object('expected',next_expected)
 where id=p_order;
 insert into public.order_events(order_id,actor_id,message) values(p_order,auth.uid(),
   format('Deactivated unstarted work order %s (%s pieces). Its QR labels and bookings were permanently deactivated. Only active work remains operational.',target.id,target.quantity));
 return manufacturing_private.workspace();
end;
$function$
;

-- manufacturing_private.individual_job_qr(text)
CREATE OR REPLACE FUNCTION manufacturing_private.individual_job_qr(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare assignment public.dumping_assignments; details jsonb;
begin
 assignment:=manufacturing_private.resolve_individual_job_qr(p_code);
 select jsonb_build_object('orderTitle',o.data->>'title','jobName',j.data->>'name','orderId',o.id)
 into details from manufacturing_private.active_sub_jobs j join manufacturing_private.active_work_orders w on w.id=j.work_order_id
 join public.orders o on o.id=w.order_id where j.id=assignment.sub_job_id;
 
  if assignment.personal_qr is true then
    details:=details||jsonb_build_object('personalQr',true,'batchQuantity',assignment.batch_quantity,
      'scanQuantity',(select greatest(0,least(assignment.batch_quantity,j.quantity-j.completed-coalesce((
        select sum(b.quantity) from manufacturing_private.active_boxes b where b.sub_job_id=j.id and b.completed_at is null
      ),0))) from manufacturing_private.active_sub_jobs j where j.id=assignment.sub_job_id));
  end if;
  return manufacturing_private.reusable_barcode(assignment.id)||details;
end;
$function$
;

-- manufacturing_private.resolve_individual_job_qr(text)
CREATE OR REPLACE FUNCTION manufacturing_private.resolve_individual_job_qr(p_code text)
 RETURNS dumping_assignments
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare assignment public.dumping_assignments;
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('admin','manager','coach','station','box_scanner') then
   raise exception 'Scanner access required' using errcode='42501';
 end if;
 
 if exists(select 1 from public.people p where p.job_qr_code=upper(trim(p_code))
   and p.job_qr_expires_on<(clock_timestamp() at time zone 'America/Chicago')::date) then
   raise exception 'This Individual Job QR has expired. Ask a manager to renew it.';
 end if;
 select a.* into assignment from public.people p join public.dumping_assignments a on a.person_id=p.id
 join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id join manufacturing_private.active_work_orders w on w.id=j.work_order_id
 join public.orders o on o.id=w.order_id
 where (p.job_qr_expires_on is null or p.job_qr_expires_on>=(clock_timestamp() at time zone 'America/Chicago')::date) and p.job_qr_code=upper(trim(p_code)) and p.kind='individual' and p.data->>'active' is distinct from 'false'
   and a.active and a.personal_qr is distinct from false and a.plan_approved_at is not null and a.work_date=(now() at time zone 'America/Chicago')::date
   and o.stage=1 and j.completed<j.quantity;
 
 if assignment.scan_assign_ready_at>clock_timestamp() then
   raise exception 'This card is assigned. Wait % seconds before recording production.',
     ceil(extract(epoch from assignment.scan_assign_ready_at-clock_timestamp()));
 end if;
 if assignment.id is null then raise exception 'This Individual Job QR has no approved, unfinished plan for today.'; end if;
 perform manufacturing_private.dumping_access(assignment.sub_job_id,false);
 return assignment;
end;
$function$
;

-- manufacturing_private.dumping_scan(text,uuid,integer,boolean)
CREATE OR REPLACE FUNCTION manufacturing_private.dumping_scan(p_id text, p_request uuid, p_pieces integer, p_personal boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare a public.dumping_assignments;c public.dumping_completions;j public.sub_jobs;w public.work_orders;o public.orders;qty integer;pending integer;fill_pieces integer;fill_seconds numeric;wait_seconds numeric;begin
 select * into a from public.dumping_assignments where id=upper(trim(p_id));
 if a.id is null then raise exception 'Reusable QR not found';end if;
 perform manufacturing_private.dumping_access(a.sub_job_id,false); perform manufacturing_private.assert_scan_not_reset(p_request);
 select * into j from manufacturing_private.active_sub_jobs where id=a.sub_job_id;select * into w from manufacturing_private.active_work_orders where id=j.work_order_id;
 select * into o from public.orders where id=w.order_id for update;
 if a.work_date is not null then perform 1 from public.people where id=a.person_id for update; end if;
 select * into a from public.dumping_assignments where id=a.id for update;
 select * into j from manufacturing_private.active_sub_jobs where id=a.sub_job_id for update;
 select * into c from manufacturing_private.active_dumping_completions where id=p_request;
 if c.id is not null then
  if c.assignment_id<>a.id or c.actor_id<>auth.uid() then raise exception 'Request reference already used';end if;
  return jsonb_build_object('duplicate',true,'pieces',c.pieces,'personId',a.person_id,'eventId',c.id);
 end if;
 if a.personal_qr is true and not p_personal then
   raise exception 'Scan the individual’s own Job QR for this plan';
 end if;
 if a.work_date is not null then
   if a.work_date<>(clock_timestamp() at time zone 'America/Chicago')::date then raise exception 'This label is planned for %. Scan the label for today.',a.work_date; end if;
   perform manufacturing_private.require_person_free(a.person_id,a.id);
 end if;
 if not a.active or o.stage<>1 then raise exception 'Assignment is closed or order is not in production';end if;
 if not exists(select 1 from public.people where id=a.person_id and coalesce(data->>'active','true')<>'false') then raise exception 'Individual is inactive';end if;
 
 select * into w from manufacturing_private.active_work_orders where id=j.work_order_id;
 
 if o.total_billable_units is not null then a.batch_quantity:=w.billable_units_per_scan; elsif a.personal_qr is not true then a.batch_quantity:=coalesce(w.scan_pieces,a.batch_quantity); end if;
 select coalesce(sum(quantity),0) into pending from manufacturing_private.active_boxes where sub_job_id=j.id and completed_at is null;
 if a.personal_qr is true and o.total_billable_units is null and p_pieces is distinct from least(a.batch_quantity,j.quantity-j.completed-pending) then
   raise exception 'The remaining pieces changed. Review the updated load and confirm again.' using errcode='PT409';
 end if;
 qty:=coalesce(p_pieces,a.batch_quantity);
 -- One full load is the minimum. A double load must have time for both loads.
 fill_pieces:=greatest(a.batch_quantity,least(qty,2*a.batch_quantity));
 fill_seconds:=ceil(coalesce(w.scan_cooldown_seconds,120) * fill_pieces::numeric / a.batch_quantity);
 if a.last_scan_at is not null then
   wait_seconds:=ceil(extract(epoch from a.last_scan_at-clock_timestamp())+fill_seconds);
   if wait_seconds>0 then
     raise exception 'Too soon to scan this reusable barcode. Try again in % min % sec.',floor(wait_seconds/60),mod(wait_seconds,60);
   end if;
 end if;

 if qty is null or qty<1 or qty>2*a.batch_quantity or qty+j.completed+pending>j.quantity then raise exception 'Batch exceeds available pieces. Enter a smaller final batch if needed.';end if;
 insert into public.dumping_completions(id,assignment_id,pieces,actor_id) values(p_request,a.id,qty,auth.uid());
 update public.dumping_assignments set last_scan_at=clock_timestamp() where id=a.id;
 update public.sub_jobs set completed=completed+qty where id=j.id;
 update public.orders set revision=revision+1,updated_at=now() where id=o.id;
 insert into public.order_events(order_id,actor_id,message) values(o.id,auth.uid(),'Reusable barcode '||a.id||': '||qty||' pieces completed.');
 return jsonb_build_object('duplicate',false,'pieces',qty,'personId',a.person_id,'eventId',p_request,'jobId',j.id,'completed',j.completed+qty);
end$function$
;

-- manufacturing_private.dashboard_production(date,integer)
CREATE OR REPLACE FUNCTION manufacturing_private.dashboard_production(p_end date, p_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 start_day date;
 trend_start date;
 result jsonb;
begin
 perform manufacturing_private.require_manager();
 if p_end is null or not isfinite(p_end) or p_days is null or p_days not in (1,7,30) then
   raise exception 'Select a valid dashboard date and period';
 end if;
 start_day:=p_end-p_days+1;
 trend_start:=p_end-greatest(p_days,7)+1;

 with events as (
   select b.person_id,r.completed_at,r.completed_pieces pieces,r.billable_units,
     exists(select 1 from public.barcode_approval_batches a
       where a.actor_id=r.actor_id and a.created_at=r.completed_at and a.kind='box' and b.id=any(a.ids)) approved
   from manufacturing_private.active_production_records r join manufacturing_private.active_boxes b on b.id=r.box_id
   where r.completed_at>=trend_start::timestamp at time zone 'America/Chicago'
     and r.completed_at<(p_end+1)::timestamp at time zone 'America/Chicago'
   union all
   select a.person_id,c.completed_at,c.pieces,c.billable_units,false
   from manufacturing_private.active_dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id
   where c.completed_at>=trend_start::timestamp at time zone 'America/Chicago'
     and c.completed_at<(p_end+1)::timestamp at time zone 'America/Chicago'
 ), period as (
   select * from events where completed_at>=start_day::timestamp at time zone 'America/Chicago'
 ), performers as (
   select p.id,p.name,sum(e.pieces) pieces,coalesce(sum(e.billable_units),0) billable_units,count(*) scans
   from period e join public.people p on p.id=e.person_id where not e.approved
   group by p.id,p.name
   order by pieces desc,scans desc,p.name,p.id limit 8
 ), daily as (
   select (completed_at at time zone 'America/Chicago')::date as scan_date,sum(pieces) pieces
   from events where not approved group by 1
 )
 select jsonb_build_object(
   'billableUnits',coalesce(sum(billable_units),0),'pieces',coalesce(sum(pieces) filter(where not approved),0),
   'scans',count(*) filter(where not approved),
   'individuals',count(distinct person_id) filter(where not approved),
   'approvedPieces',coalesce(sum(pieces) filter(where approved),0),
   'latestScan',max(completed_at) filter(where not approved),
   'plannedDate',p_end,
   'plannedOrderIds',coalesce((
     select jsonb_agg(distinct w.order_id order by w.order_id)
     from public.dumping_assignments a join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id
     join manufacturing_private.active_work_orders w on w.id=j.work_order_id
     where a.work_date=p_end and (a.active or exists(
       select 1 from manufacturing_private.active_dumping_completions c where c.assignment_id=a.id
     ))
   ),'[]'),
   'performers',coalesce((select jsonb_agg(to_jsonb(p) order by p.pieces desc,p.scans desc,p.name,p.id) from performers p),'[]'),
   'daily',(select jsonb_agg(jsonb_build_object('date',trend_start+i,'pieces',coalesce(d.pieces,0)) order by i)
     from generate_series(0,p_end-trend_start) i left join daily d on d.scan_date=trend_start+i)
 ) into result from period;
 return result;
end;
$function$
;

-- manufacturing_private.release_job_qr_assignment(text,date)
CREATE OR REPLACE FUNCTION manufacturing_private.release_job_qr_assignment(p_assignment text, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare oid text; assignment public.dumping_assignments;
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('admin','manager','coach','station','box_setup') then
   raise exception 'Plan access requires box setup permissions' using errcode='42501';
 end if;
 if p_date is null or not isfinite(p_date) or p_date<(now() at time zone 'America/Chicago')::date then
   raise exception 'Select an assignment for today or a future date';
 end if;
 select * into assignment from public.dumping_assignments where id=p_assignment and work_date=p_date;
 if assignment.id is null then raise exception 'Plan assignment no longer exists'; end if;
 perform manufacturing_private.dumping_access(assignment.sub_job_id,true);
 select w.order_id into oid from manufacturing_private.active_sub_jobs j join manufacturing_private.active_work_orders w on w.id=j.work_order_id
 where j.id=assignment.sub_job_id;
 perform 1 from public.orders where id=oid for update;
 perform pg_advisory_xact_lock(hashtextextended('day-plan:'||p_date::text,0));
 update public.dumping_assignments set active=false
 where id=p_assignment and work_date=p_date and active;
 if found then
   update public.orders set revision=revision+1,updated_at=now() where id=oid;
   insert into public.order_events(order_id,actor_id,message) values(oid,auth.uid(),
     format('Released plan assignment %s for reassignment. Recorded pieces retained.',p_assignment));
 end if;
 return manufacturing_private.day_plan(p_date);
end;
$function$
;

-- manufacturing_private.accounts_payroll_report(date)
CREATE OR REPLACE FUNCTION manufacturing_private.accounts_payroll_report(p_start date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  cutoff timestamptz;
  starts_at timestamptz;
  ends_at timestamptz;
begin
  if auth.uid() is null or manufacturing_private.actor_role() is distinct from 'accounts' then
    raise exception 'Accounts access required' using errcode='42501';
  end if;
  if p_start is null or not isfinite(p_start) or extract(isodow from p_start)<>1 then
    raise exception 'Choose a Monday for the start of Week 1' using errcode='22023';
  end if;
  starts_at:=p_start::timestamp at time zone 'America/Chicago';
  cutoff:=(p_start+7)::timestamp at time zone 'America/Chicago';
  ends_at:=(p_start+14)::timestamp at time zone 'America/Chicago';

  return (
    with scans as (
      select b.person_id,b.sub_job_id,b.completed_at,coalesce(r.billable_units,b.completed_pieces) as pieces,r.billable_units,r.pay_rate_snapshot
      from manufacturing_private.active_boxes b left join lateral (select rr.billable_units,rr.pay_rate_snapshot from manufacturing_private.active_production_records rr where rr.box_id=b.id order by rr.completed_at desc limit 1) r on true
      where b.completed_at>=starts_at and b.completed_at<ends_at
      union all
      select a.person_id,a.sub_job_id,c.completed_at,coalesce(c.billable_units,c.pieces),c.billable_units,c.pay_rate_snapshot
      from manufacturing_private.active_dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id
      where c.completed_at>=starts_at and c.completed_at<ends_at
    ), rated_scans as (
      select s.person_id,s.completed_at,s.pieces,
        case when s.billable_units is not null then s.pay_rate_snapshot when jsonb_typeof(o.data->'catalogRate')='number'
          then (o.data->>'catalogRate')::numeric end as rate
      from scans s
      join manufacturing_private.active_sub_jobs j on j.id=s.sub_job_id
      join manufacturing_private.active_work_orders w on w.id=j.work_order_id
      join public.orders o on o.id=w.order_id
    ), scan_totals as (
      select person_id,
        sum(pieces) filter(where completed_at<cutoff) as pieces1,
        sum(pieces) filter(where completed_at>=cutoff) as pieces2,
        round(sum(pieces*rate) filter(where completed_at<cutoff),2) as pay1,
        round(sum(pieces*rate) filter(where completed_at>=cutoff),2) as pay2,
        count(*) filter(where completed_at<cutoff and pieces>0 and rate is null) as missing1,
        count(*) filter(where completed_at>=cutoff and pieces>0 and rate is null) as missing2
      from rated_scans group by person_id
    ), daily_hours as (
      select person_id,date,work_hours from public.daily_attendance
      where date>=p_start and date<p_start+14
      union all
      select t.person_id,t.week_start+d.day_offset,
        case when jsonb_typeof(t.data#>array['days',(t.week_start+d.day_offset)::text,'workHours'])='number'
          then (t.data#>>array['days',(t.week_start+d.day_offset)::text,'workHours'])::numeric end
      from public.individual_timesheets t cross join generate_series(0,6) d(day_offset)
      where t.week_start in (p_start,p_start+7)
        and not exists (
          select 1 from public.daily_attendance a
          where a.person_id=t.person_id and a.date=t.week_start+d.day_offset
        )
    ), hour_totals as (
      select person_id,
        sum(work_hours) filter(where date<p_start+7) as week1,
        sum(work_hours) filter(where date>=p_start+7) as week2
      from daily_hours group by person_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'name',p.name,'number',p.data->>'sourceNumber',
      'week1Pieces',coalesce(s.pieces1,0),'week2Pieces',coalesce(s.pieces2,0),
      'week1WsPay',case when coalesce(s.missing1,0)=0 then coalesce(s.pay1,0) end,
      'week2WsPay',case when coalesce(s.missing2,0)=0 then coalesce(s.pay2,0) end,
      'week1MissingRate',coalesce(s.missing1,0)>0,
      'week2MissingRate',coalesce(s.missing2,0)>0,
      'week1Hours',h.week1,'week2Hours',h.week2
    ) order by p.name,p.id),'[]'::jsonb)
    from public.people p
    left join scan_totals s on s.person_id=p.id
    left join hour_totals h on h.person_id=p.id
    where p.kind='individual' and (s.person_id is not null or h.person_id is not null)
  );
end;
$function$
;

-- manufacturing_private.day_plan_group(date,text,text[],text[],uuid,boolean)
CREATE OR REPLACE FUNCTION manufacturing_private.day_plan_group(p_date date, p_job text, p_people text[], p_expected text[], p_plan uuid, p_personal boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r text:=manufacturing_private.actor_role(); today date:=(clock_timestamp() at time zone 'America/Chicago')::date;
 j public.sub_jobs; w public.work_orders; o public.orders; pid text; p public.people;
 current_people text[]; plan_personal boolean; plan_load integer; selected text[]; other_count int;
begin
 if auth.uid() is null or coalesce(r,'') not in ('admin','manager','coach','station','box_setup') then
   raise exception 'Plan access requires box setup permissions' using errcode='42501';
 end if;
 if p_date is null or not isfinite(p_date) then raise exception 'Select a work date';end if;
 if p_people is not null then
   if exists(select 1 from public.dumping_assignments where plan_id=p_plan and scan_assign_approval_id is not null) then
     raise exception 'Manage this assignment through Scan & Assign';
   end if;
   if exists(select 1 from manufacturing_private.deactivated_plans where job_id=p_job and work_date=p_date and plan_key=coalesce(p_plan::text,'legacy')) then raise exception 'This plan is permanently inactive. Create a new plan instead.' using errcode='PT409';end if;
   if p_date<today then raise exception 'Plans for past dates are read-only';end if;
   if p_job is null or p_expected is null or cardinality(p_people)>100 or array_position(p_people,null) is not null then
     raise exception 'Select a sub-job and up to 100 individuals';
   end if;
   perform manufacturing_private.dumping_access(p_job,true);
   select * into j from manufacturing_private.active_sub_jobs where id=p_job;
   select * into w from manufacturing_private.active_work_orders where id=j.work_order_id;
   select * into o from public.orders where id=w.order_id for update;
   perform pg_advisory_xact_lock(hashtextextended('day-plan:'||p_date::text,0));
   select * into j from manufacturing_private.active_sub_jobs where id=p_job for update;
   if o.stage<>1 or j.completed>=j.quantity then raise exception 'Select an unfinished sub-job in production';end if;
   select coalesce(array_agg(distinct id order by id),'{}') into selected from unnest(p_people) id;
   select coalesce(array_agg(person_id order by person_id),'{}') into current_people
   from public.dumping_assignments where sub_job_id=p_job and work_date=p_date and plan_id is not distinct from p_plan and active;
   
   select a.personal_qr,a.batch_quantity into plan_personal,plan_load
     from public.dumping_assignments a where a.sub_job_id=p_job and a.work_date=p_date
       and a.plan_id is not distinct from p_plan and a.active order by a.id limit 1;
   if not found then
     plan_personal:=p_personal;
     plan_load:=coalesce(w.scan_pieces,w.pieces_per_pack);
   elsif p_personal is not null and plan_personal is distinct from p_personal then
     raise exception 'The QR method cannot change after a plan is saved';
   end if;
   if selected<>current_people then
     if cardinality(selected)=0 and manufacturing_private.day_plan_has_scans(p_job,p_date,p_plan) then
       raise exception 'This plan cannot be deactivated because scans have been recorded.';
     end if;
     if cardinality(selected)=0 then insert into manufacturing_private.deactivated_plans(job_id,work_date,plan_key,deactivated_by) values(p_job,p_date,coalesce(p_plan::text,'legacy'),auth.uid());end if;
     if current_people<>p_expected then raise exception 'This plan changed on another device. Refresh and review it.' using errcode='PT409';end if;
     update public.dumping_assignments set plan_approved_at=null where sub_job_id=p_job and work_date=p_date and plan_id is not distinct from p_plan and active and plan_approved_at is not null;
     -- Lock people in stable order before changing their assignments.
     perform 1 from public.people where id=any(selected||current_people) order by id for update;
     -- A finished sub-job frees its people for another plan on the same day.
     update public.dumping_assignments a set active=false
     from manufacturing_private.active_sub_jobs sj join manufacturing_private.active_work_orders wo on wo.id=sj.work_order_id
       join public.orders ord on ord.id=wo.order_id
     where a.sub_job_id=sj.id and a.work_date=p_date and a.active and a.person_id=any(selected)
       and (sj.completed>=sj.quantity or ord.stage<>1);
     select count(*) into other_count from public.dumping_assignments a
       join manufacturing_private.active_sub_jobs sj on sj.id=a.sub_job_id join manufacturing_private.active_work_orders wo on wo.id=sj.work_order_id
       join public.orders ord on ord.id=wo.order_id
       where a.work_date=p_date and a.active and not (a.sub_job_id=p_job and a.plan_id is not distinct from p_plan) and sj.completed<sj.quantity and ord.stage=1;
     if other_count+cardinality(selected)>100 then raise exception 'A daily plan can contain up to 100 stickers';end if;
     foreach pid in array selected loop
       if pid=any(current_people) then continue;end if;
       select * into p from public.people where id=pid;
       if p.id is null or p.kind<>'individual' or p.data->>'active'='false' then raise exception 'Select active individuals';end if;
       if exists(select 1 from public.dumping_assignments where person_id=pid and work_date=p_date and active and (sub_job_id<>p_job or plan_id is distinct from p_plan)) then
         raise exception '% is already on another sub-job plan for that day',p.name;
       end if;
       if p_date=today then perform manufacturing_private.require_person_free(pid);end if;
     end loop;
     update public.dumping_assignments set active=false
       where sub_job_id=p_job and work_date=p_date and plan_id is not distinct from p_plan and active and not(person_id=any(selected));
     
     if plan_personal is true then
       update public.people set job_qr_code='IND-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16))
       where id=any(selected) and job_qr_code is null;
     end if;
     insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,work_date,created_by,plan_id,personal_qr)
       select 'REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),p_job,id,case when plan_personal then plan_load else w.pieces_per_pack end,p_date,auth.uid(),p_plan,plan_personal
       from unnest(selected) id where not(id=any(current_people));
   end if;
 end if;
 return coalesce((
   select jsonb_agg(jsonb_build_object('id',a.id,'jobId',sj.id,'workId',wo.id,'orderId',ord.id,
     'orderTitle',ord.data->>'title','jobName',sj.data->>'name','personId',a.person_id,
     'personName',person.name,'batchQuantity',case when a.personal_qr then a.batch_quantity else coalesce(wo.scan_pieces,a.batch_quantity) end,'personalQr',a.personal_qr,'scanAssign',a.scan_assign_approval_id is not null,'workDate',a.work_date,'approvedAt',a.plan_approved_at,'planId',a.plan_id,'hasScans',manufacturing_private.day_plan_has_scans(sj.id,a.work_date,a.plan_id))
     order by ord.id,sj.id,a.plan_id nulls first,person.name,person.id)
   from public.dumping_assignments a join manufacturing_private.active_sub_jobs sj on sj.id=a.sub_job_id
   join manufacturing_private.active_work_orders wo on wo.id=sj.work_order_id join public.orders ord on ord.id=wo.order_id
   join public.people person on person.id=a.person_id
   where a.work_date=p_date and a.active and manufacturing_private.can_read_order(ord.id)
     and (p_date<today or (ord.stage=1 and sj.completed<sj.quantity))
     and (r<>'coach' or manufacturing_private.coach_can_manage_work(wo.id))
 ),'[]'::jsonb);
end$function$
;

-- manufacturing_private.save_booking(jsonb)
CREATE OR REPLACE FUNCTION manufacturing_private.save_booking(p_booking jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare w public.work_orders; o public.orders; p public.people;
 start_day date:=(p_booking->>'start')::date; end_day date:=(p_booking->>'end')::date;
 allocated jsonb;
begin
 perform manufacturing_private.require_manager();
 select * into w from manufacturing_private.active_work_orders where id=p_booking->>'workId';
 select * into o from public.orders where id=w.order_id;
 if w.id is null or o.stage>1 or o.id<>p_booking->>'orderId' then raise exception 'Select an active work order';end if;
 select * into p from public.people where id=p_booking->>'personId' for update;
 if p.id is null or p.data->>'active'='false' then raise exception 'Select an active individual';end if;
 if start_day is null or end_day is null or end_day<start_day or end_day-start_day>3659 then
   raise exception 'Choose a valid date range of up to 3660 days';
 end if;
 select jsonb_agg(d::date order by d) into allocated
 from generate_series(start_day::timestamp,end_day::timestamp,interval '1 day') d
 where coalesce((p.data->'weeklyHours'->>(extract(isodow from d)::int-1))::numeric,
   case when extract(isodow from d)<6 then p.hours_per_day else 0 end)>0;
 if allocated is null then raise exception 'Booking must contain an available day';end if;
 insert into public.bookings(id,person_id,order_id,work_order_id,starts_on,ends_on,hours,status,data)
 values(p_booking->>'id',p.id,o.id,w.id,start_day,end_day,(p_booking->>'hours')::numeric,'booked',p_booking||jsonb_build_object('allocatedDates',allocated))
 on conflict(id) do update set person_id=excluded.person_id,starts_on=excluded.starts_on,ends_on=excluded.ends_on,
   hours=excluded.hours,status='booked',data=excluded.data
 where bookings.order_id=excluded.order_id and bookings.work_order_id=excluded.work_order_id;
 return manufacturing_private.workspace();
end$function$
;

-- manufacturing_private.work_order_has_scans(text)
CREATE OR REPLACE FUNCTION manufacturing_private.work_order_has_scans(p_work text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select exists (
   select 1 from manufacturing_private.active_sub_jobs j join manufacturing_private.active_boxes b on b.sub_job_id=j.id
   where j.work_order_id=p_work and (b.completed_at is not null or exists (
     select 1 from manufacturing_private.active_production_records r where r.box_id=b.id
   ))
 ) or exists (
   select 1 from manufacturing_private.active_sub_jobs j
   join public.dumping_assignments a on a.sub_job_id=j.id
   join manufacturing_private.active_dumping_completions c on c.assignment_id=a.id
   where j.work_order_id=p_work
 );
$function$
;

-- manufacturing_private.replace_unstarted_sub_jobs(text,integer,jsonb,boolean)
CREATE OR REPLACE FUNCTION manufacturing_private.replace_unstarted_sub_jobs(p_work text, p_stage integer, p_jobs jsonb, p_replace boolean)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare old_jobs text[];
begin
 select array_agg(id) into old_jobs from manufacturing_private.active_sub_jobs where work_order_id=p_work;
 if old_jobs is null or not exists (
   select 1 from unnest(old_jobs) old_job(id) where not exists (
     select 1 from jsonb_array_elements(p_jobs) new_job where new_job->>'id'=old_job.id
   )
 ) then return; end if;

 if p_replace is not true then
   raise exception 'Confirm sub-job replacement before removing the existing split';
 end if;
 if p_stage not in (0,1) or manufacturing_private.work_order_has_scans(p_work)
   or exists (select 1 from manufacturing_private.active_sub_jobs where id=any(old_jobs) and completed>0)
 then raise exception 'Sub-jobs cannot be replaced after production progress has been recorded'; end if;

 if jsonb_array_length(p_jobs)=0 or exists (
   select 1 from jsonb_array_elements(p_jobs) new_job
   where nullif(new_job->>'id','') is null or (new_job->>'id')=any(old_jobs)
     or coalesce((new_job->>'completed')::integer,0)<>0
 ) or (select count(distinct new_job->>'id') from jsonb_array_elements(p_jobs) new_job)
   <> jsonb_array_length(p_jobs)
 then raise exception 'Replace the entire split with new, unstarted sub-jobs'; end if;

 -- Scan history was checked under the order lock. Any printed labels attached
 -- to the old sub-jobs must become unusable before the new split is published.
 
 
 update public.sub_jobs set active=false,deactivation_reason='Replaced by a new sub-job split' where id=any(old_jobs) and active;
end;
$function$
;

-- manufacturing_private.approve_scan_assign(date,text,integer,boolean)
CREATE OR REPLACE FUNCTION manufacturing_private.approve_scan_assign(p_date date, p_job text, p_pieces integer, p_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j public.sub_jobs; w public.work_orders; approval public.scan_assign_approvals; qty integer;
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('admin','manager','coach','station','box_setup') then
   raise exception 'Plan approval access required' using errcode='42501';
 end if;
 if p_date is null or not isfinite(p_date) or p_date<(clock_timestamp() at time zone 'America/Chicago')::date or p_enabled is null then
   raise exception 'Choose today or a future work date';
 end if;
 perform manufacturing_private.dumping_access(p_job,true);
 select * into j from manufacturing_private.active_sub_jobs where id=p_job;
 select * into w from manufacturing_private.active_work_orders where id=j.work_order_id;
 perform 1 from public.orders where id=w.order_id and stage=1 for update;
 if not found then raise exception 'Select an order in production'; end if;
 select * into j from manufacturing_private.active_sub_jobs where id=p_job for update;
 select * into approval from manufacturing_private.active_scan_assign_approvals where sub_job_id=p_job and work_date=p_date for update;
 if not p_enabled then
   update public.scan_assign_approvals set revoked_at=clock_timestamp() where id=approval.id and revoked_at is null;
   update public.dumping_assignments set active=false where scan_assign_approval_id=approval.id and active;
 else
   if j.completed>=j.quantity then raise exception 'Select an unfinished sub-job'; end if;
   qty:=coalesce(p_pieces,w.scan_pieces,w.pieces_per_pack);
   if qty not between 1 and least(1000000,w.quantity) then raise exception 'Choose a valid number of pieces per scan'; end if;
   if approval.id is not null and exists(select 1 from public.dumping_assignments where scan_assign_approval_id=approval.id)
     and approval.pieces_per_scan<>qty then raise exception 'Pieces per scan cannot change after cards have been assigned'; end if;
   insert into public.scan_assign_approvals(sub_job_id,work_date,pieces_per_scan,approved_by)
   values(p_job,p_date,qty,auth.uid())
   on conflict(sub_job_id,work_date) do update set pieces_per_scan=excluded.pieces_per_scan,
     approved_at=clock_timestamp(),approved_by=auth.uid(),revoked_at=null,completed_at=null,completed_by=null;
 end if;
 update public.orders set revision=revision+1,updated_at=now() where id=w.order_id;
 insert into public.order_events(order_id,actor_id,message) values(w.order_id,auth.uid(),
   format('Scan & Assign %s for %s on %s.',case when p_enabled then 'approved' else 'revoked' end,p_job,p_date));
 return manufacturing_private.scan_assign_approvals(p_date);
end $function$
;

-- manufacturing_private.save_scan_settings(text,integer,integer)
CREATE OR REPLACE FUNCTION manufacturing_private.save_scan_settings(p_work text, p_seconds integer, p_pieces integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare oid text;
begin
 perform manufacturing_private.require_admin_approvals();
 if p_seconds not between 0 and 604800 or p_pieces not between 1 and 1000000 then
   raise exception 'Enter 0–604800 seconds and 1–1000000 pieces, or leave the fields blank for defaults';
 end if;
 select o.id into oid from public.orders o join manufacturing_private.active_work_orders w on w.order_id=o.id
 where w.id=p_work and o.stage=1 for update of o;
 if oid is null then raise exception 'Select a work order in production'; end if;
 if p_pieces>(select quantity from manufacturing_private.active_work_orders where id=p_work) then
   raise exception 'Pieces per scan cannot exceed the work order quantity';
 end if;
 update public.work_orders set scan_cooldown_seconds=p_seconds,scan_pieces=p_pieces
 where id=p_work and (scan_cooldown_seconds,scan_pieces) is distinct from (p_seconds,p_pieces);
 if found then
   update public.orders set revision=revision+1,updated_at=now() where id=oid;
   insert into public.order_events(order_id,actor_id,message) values(oid,auth.uid(),
     format('Scan settings for %s: %s seconds per load, %s pieces per load.',p_work,
       coalesce(p_seconds::text,'calculated'),coalesce(p_pieces::text,'label default')));
 end if;
 return jsonb_build_object('seconds',p_seconds,'pieces',p_pieces);
end;
$function$
;

-- manufacturing_private.scan_history(date,date,text,text,text,text,integer)
CREATE OR REPLACE FUNCTION manufacturing_private.scan_history(p_start date, p_end date, p_kind text, p_person text, p_order text, p_search text, p_offset integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 perform manufacturing_private.require_admin_approvals();
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_start>p_end
   or p_kind is null or p_kind not in ('all','box','reusable')
   or p_offset is null or p_offset not between 0 and 1000000 or length(coalesce(p_search,''))>160
 then raise exception 'Check the scan history filters'; end if;
 with events as (
   select r.id::text,b.id qr,b.person_id,b.sub_job_id,r.completed_at,r.completed_pieces pieces,'box'::text kind,
     case when exists(select 1 from public.barcode_approval_batches a
       where a.actor_id=r.actor_id and a.created_at=r.completed_at and a.kind='box' and b.id=any(a.ids))
     then 'Admin approval' else 'Scan' end source
   from manufacturing_private.active_production_records r join manufacturing_private.active_boxes b on b.id=r.box_id
   where p_kind in ('all','box')
     and r.completed_at>=(p_start::timestamp at time zone 'America/Chicago')
     and r.completed_at<((p_end+1)::timestamp at time zone 'America/Chicago')
   union all
   select c.id::text,a.id,a.person_id,a.sub_job_id,c.completed_at,c.pieces,'reusable','Scan'
   from manufacturing_private.active_dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id
   where p_kind in ('all','reusable')
     and c.completed_at>=(p_start::timestamp at time zone 'America/Chicago')
     and c.completed_at<((p_end+1)::timestamp at time zone 'America/Chicago')
 ), filtered as (
   select e.id,e.qr,e.completed_at,e.pieces,e.kind,e.source,p.name person,o.id order_id,
     o.data->>'title' title,o.data->>'catalogCode' code,w.id work_id,j.data->>'name' sub_job
   from events e join public.people p on p.id=e.person_id
   join manufacturing_private.active_sub_jobs j on j.id=e.sub_job_id join manufacturing_private.active_work_orders w on w.id=j.work_order_id
   join public.orders o on o.id=w.order_id
   where (p_person is null or e.person_id=p_person) and (p_order is null or o.id=p_order)
     and (coalesce(trim(p_search),'')='' or strpos(lower(concat_ws(' ',e.qr,p.name,o.id,o.data->>'title',
       o.data->>'catalogCode',o.data->>'orderNumber',w.id,j.data->>'name')),lower(trim(p_search)))>0)
 )
 select jsonb_build_object('total',count(*),'pieces',coalesce(sum(pieces),0),'rows',
   coalesce((select jsonb_agg(to_jsonb(page) order by completed_at desc,kind,id)
     from (select * from filtered order by completed_at desc,kind,id limit 50 offset p_offset) page),'[]'))
 into result from filtered;
 return result;
end;
$function$
;

-- manufacturing_private.scan_reusable_configured(text,uuid,integer,integer)
CREATE OR REPLACE FUNCTION manufacturing_private.scan_reusable_configured(p_id text, p_request uuid, p_pieces integer, p_expected_load integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare oid text; jid text; load_size integer;
begin
 if p_expected_load is not null then
   select w.order_id,j.id into oid,jid from public.dumping_assignments a
   join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id join manufacturing_private.active_work_orders w on w.id=j.work_order_id
   where a.id=upper(trim(p_id));
   if jid is not null then
     perform manufacturing_private.dumping_access(jid,false);
     perform 1 from public.orders where id=oid for update;
     if not exists(select 1 from manufacturing_private.active_dumping_completions where id=p_request) then
       select coalesce(w.scan_pieces,a.batch_quantity) into load_size
       from public.dumping_assignments a join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id
       join manufacturing_private.active_work_orders w on w.id=j.work_order_id where a.id=upper(trim(p_id));
       if load_size is distinct from p_expected_load then
         raise exception 'Pieces per scan changed. Review the updated load and confirm again.' using errcode='PT409';
       end if;
     end if;
   end if;
 end if;
 return manufacturing_private.dumping_scan(p_id,p_request,p_pieces);
end;
$function$
;

-- manufacturing_private.can_read_order(text)
CREATE OR REPLACE FUNCTION manufacturing_private.can_read_order(p_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and (manufacturing_private.actor_role() in ('admin','manager') or
 (manufacturing_private.actor_role() in ('station','box_setup','box_scanner') and exists(select 1 from public.orders where id=p_id and stage=1)) or
 (manufacturing_private.actor_role()='coach' and exists(select 1 from manufacturing_private.active_work_orders w where w.order_id=p_id and manufacturing_private.coach_can_manage_work(w.id))));
$function$
;

-- manufacturing_private.dumping_assign(text,text,text,integer)
CREATE OR REPLACE FUNCTION manufacturing_private.dumping_assign(p_id text, p_job text, p_person text, p_quantity integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare oid text;begin
 perform manufacturing_private.dumping_access(p_job,true);
 select w.order_id into oid from manufacturing_private.active_sub_jobs j join manufacturing_private.active_work_orders w on w.id=j.work_order_id where j.id=p_job;
 perform 1 from public.orders where id=oid and stage=1 for update;if not found then raise exception 'Order is not in production';end if;
 if not exists(select 1 from public.people where id=p_person and kind='individual' and coalesce(data->>'active','true')<>'false') then raise exception 'Select an active individual';end if;
 if not exists(select 1 from manufacturing_private.active_sub_jobs where id=p_job and completed<quantity) then raise exception 'Sub-job is already complete';end if;
 perform manufacturing_private.require_person_free(p_person,p_id); insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,created_by) values(p_id,p_job,p_person,p_quantity,auth.uid()) on conflict(id) do nothing;
 if not exists(select 1 from public.dumping_assignments where id=p_id and sub_job_id=p_job and person_id=p_person and batch_quantity=p_quantity and active) then raise exception 'Assignment reference already used';end if;
 return manufacturing_private.dumping_list();
end$function$
;

-- manufacturing_private.dumping_list()
CREATE OR REPLACE FUNCTION manufacturing_private.dumping_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if auth.uid() is null or manufacturing_private.actor_role() is null then raise exception 'Staff access required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(x order by x->>'createdAt' desc) from (select jsonb_build_object('id',a.id,'jobId',a.sub_job_id,'workId',w.id,'orderId',o.id,'personId',a.person_id,'batchQuantity',coalesce(w.scan_pieces,a.batch_quantity),'workDate',a.work_date,'active',a.active,'createdAt',a.created_at,'pieces',coalesce((select sum(pieces) from manufacturing_private.active_dumping_completions c where c.assignment_id=a.id),0)) x from public.dumping_assignments a join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id join manufacturing_private.active_work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id where manufacturing_private.can_read_order(o.id) and (manufacturing_private.actor_role()<>'coach' or manufacturing_private.coach_can_manage_work(w.id)) order by a.created_at desc limit 500) q),'[]');
end$function$
;

-- manufacturing_private.dumping_access(text,boolean)
CREATE OR REPLACE FUNCTION manufacturing_private.dumping_access(p_job text, p_setup boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare r text:=manufacturing_private.actor_role();w public.work_orders;begin
 if auth.uid() is null or r is null or (p_setup and r not in ('admin','manager','coach','station','box_setup')) or (not p_setup and r not in ('admin','manager','coach','station','box_scanner')) then raise exception 'Dumping access denied' using errcode='42501';end if;
 select wo.* into w from manufacturing_private.active_work_orders wo join manufacturing_private.active_sub_jobs j on j.work_order_id=wo.id where j.id=p_job;
 if w.id is null or not manufacturing_private.can_read_order(w.order_id) or (r='coach' and not manufacturing_private.coach_can_manage_work(w.id)) then raise exception 'Work access denied' using errcode='42501';end if;
end$function$
;

-- manufacturing_private.timesheet(text,date,jsonb,bigint)
CREATE OR REPLACE FUNCTION manufacturing_private.timesheet(p_person text, p_week date, p_data jsonb DEFAULT NULL::jsonb, p_revision bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sheet public.individual_timesheets;entries jsonb;roster jsonb;report jsonb;
begin
 
     if manufacturing_private.actor_role()='accounts' then
       if p_data is not null then raise exception 'Accounts timesheets are read-only' using errcode='42501'; end if;
     else
       perform manufacturing_private.require_manager();
     end if;
   
 if extract(isodow from p_week)<>1 or p_week is null then raise exception 'Select a Monday';end if;
 if not exists(select 1 from public.people where id=p_person and kind='individual') then raise exception 'Select an individual';end if;
 if p_data is not null then
  if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>100000 then raise exception 'Invalid timesheet';end if;
  insert into public.individual_timesheets(person_id,week_start,data,updated_by) values(p_person,p_week,p_data,auth.uid())
  on conflict(person_id,week_start) do update set data=excluded.data,revision=individual_timesheets.revision+1,updated_at=now(),updated_by=auth.uid() where individual_timesheets.revision=p_revision;
  if not found then raise exception 'Timesheet changed elsewhere. Reload before saving.' using errcode='PT409';end if;
 end if;
 select * into sheet from public.individual_timesheets where person_id=p_person and week_start=p_week;
 select coalesce(jsonb_agg(e.record order by e.at,e.id),'[]') into entries from (
 select b.completed_at at,b.id, jsonb_build_object('boxId',b.id,
 'workId',w.id,'itemCode',coalesce(
  nullif((select o.data->>'catalogCode' from public.orders o where o.id=w.order_id),''),
  (select i.code from public.orders o join public.customer_items i on i.id::text=o.data->>'catalogItemId' where o.id=w.order_id),
  nullif(w.data->>'partCode',''),'Uncoded item'),'code'
 ,coalesce(nullif(w.data->>'partCode',''),w.id),'description',w.data->>'description','date',(b.completed_at at time zone 'America/Chicago')::date,'time',to_char(b.completed_at at time zone 'America/Chicago','HH24:MI'),'billableUnits',(select r.billable_units from manufacturing_private.active_production_records r where r.box_id=b.id limit 1),'pieces',b.completed_pieces) record
 from manufacturing_private.active_boxes b join manufacturing_private.active_sub_jobs j on j.id=b.sub_job_id join manufacturing_private.active_work_orders w on w.id=j.work_order_id where b.completed_at is not null and b.person_id=p_person and (b.completed_at at time zone 'America/Chicago')::date>=p_week and (b.completed_at at time zone 'America/Chicago')::date<p_week+7
 union all
 select c.completed_at,c.id::text,jsonb_build_object('boxId',c.id,
 'workId',w.id,'itemCode',coalesce(
  nullif((select o.data->>'catalogCode' from public.orders o where o.id=w.order_id),''),
  (select i.code from public.orders o join public.customer_items i on i.id::text=o.data->>'catalogItemId' where o.id=w.order_id),
  nullif(w.data->>'partCode',''),'Uncoded item'),'code'
 ,coalesce(nullif(w.data->>'partCode',''),w.id),'description',w.data->>'description','date',(c.completed_at at time zone 'America/Chicago')::date,'time',to_char(c.completed_at at time zone 'America/Chicago','HH24:MI'),'billableUnits',c.billable_units,'pieces',c.pieces,'mode','dumping')
 from manufacturing_private.active_dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id join manufacturing_private.active_work_orders w on w.id=j.work_order_id where a.person_id=p_person and (c.completed_at at time zone 'America/Chicago')::date>=p_week and (c.completed_at at time zone 'America/Chicago')::date<p_week+7
 ) e;
 report:=coalesce(sheet.data,'{}'::jsonb);
 select coalesce(jsonb_object_agg(d.date::text,coalesce(report#>array['days',d.date::text],'{}'::jsonb)||jsonb_build_object('arrival',to_char(d.arrival,'HH24:MI'),'departure',to_char(d.departure,'HH24:MI'),'workHours',d.work_hours,'attendanceStatus',d.status)),'{}') into roster from public.daily_attendance d where d.person_id=p_person and d.date>=p_week and d.date<p_week+7;
 report:=jsonb_set(report,'{days}',coalesce(report->'days','{}'::jsonb)||roster);

 
     if manufacturing_private.actor_role()='accounts' then
       report:=jsonb_build_object('days',coalesce((
         select jsonb_object_agg(d.key,jsonb_build_object(
           'arrival',d.value->'arrival','departure',d.value->'departure',
           'workHours',d.value->'workHours','comHours',d.value->'comHours',
           'serviceCommunity',d.value->'serviceCommunity','attendanceStatus',d.value->'attendanceStatus'))
         from jsonb_each(coalesce(report->'days','{}')) d
       ),'{}'));
     end if;
   return jsonb_build_object('data',report,'revision',coalesce(sheet.revision,0),'entries',entries);
end$function$
;

-- manufacturing_private.require_person_free(text,text)
CREATE OR REPLACE FUNCTION manufacturing_private.require_person_free(p_person text, p_existing text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 perform 1 from public.people where id=p_person and kind='individual' and coalesce(data->>'active','true')<>'false' for update;
 if not found then raise exception 'Select an active individual';end if;
 if exists(select 1 from manufacturing_private.active_boxes where person_id=p_person and completed_at is null and id is distinct from p_existing)
 or exists(select 1 from public.dumping_assignments a join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id join manufacturing_private.active_work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id where a.person_id=p_person and a.active and (a.work_date is null or a.work_date=(now() at time zone 'America/Chicago')::date) and j.completed<j.quantity and o.stage=1 and a.id is distinct from p_existing) then
 raise exception 'This individual already has work. Complete the current box or close the reusable assignment before creating another barcode.';
 end if;
end$function$
;

-- manufacturing_private.person_current_work(text)
CREATE OR REPLACE FUNCTION manufacturing_private.person_current_work(p_person text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare r text:=manufacturing_private.actor_role();items jsonb;occupied boolean;begin
 if auth.uid() is null or coalesce(r,'') not in ('admin','manager','coach','station','box_setup') then raise exception 'Box setup access required' using errcode='42501';end if;
 select exists(select 1 from manufacturing_private.active_boxes where person_id=p_person and completed_at is null) or exists(select 1 from public.dumping_assignments a join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id join manufacturing_private.active_work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id where a.person_id=p_person and a.active and (a.work_date is null or a.work_date=(now() at time zone 'America/Chicago')::date) and j.completed<j.quantity and o.stage=1) into occupied;
 select coalesce(jsonb_agg(x),'[]') into items from (
 select jsonb_build_object('kind','box','id',b.id,'personId',b.person_id,'quantity',b.quantity,'orderId',o.id,'orderTitle',o.data->>'title','workId',w.id,'description',w.data->>'description','jobId',j.id,'jobName',j.data->>'name') x
 from manufacturing_private.active_boxes b join manufacturing_private.active_sub_jobs j on j.id=b.sub_job_id join manufacturing_private.active_work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id
 where b.person_id=p_person and b.completed_at is null and manufacturing_private.can_read_order(o.id) and (r<>'coach' or manufacturing_private.coach_can_manage_work(w.id))
 union all
 select jsonb_build_object('kind','dumping','id',a.id,'personId',a.person_id,'quantity',a.batch_quantity,'workDate',a.work_date,'orderId',o.id,'orderTitle',o.data->>'title','workId',w.id,'description',w.data->>'description','jobId',j.id,'jobName',j.data->>'name')
 from public.dumping_assignments a join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id join manufacturing_private.active_work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id
 where a.person_id=p_person and a.active and (a.work_date is null or a.work_date=(now() at time zone 'America/Chicago')::date) and j.completed<j.quantity and o.stage=1 and manufacturing_private.can_read_order(o.id) and (r<>'coach' or manufacturing_private.coach_can_manage_work(w.id))
 ) q;
 return jsonb_build_object('busy',occupied,'items',items);
end$function$
;

-- manufacturing_private.barcode_queue(text,date,date,text,integer)
CREATE OR REPLACE FUNCTION manufacturing_private.barcode_queue(p_kind text DEFAULT 'box'::text, p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_search text DEFAULT ''::text, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare rows jsonb;total bigint;begin
 perform manufacturing_private.require_admin_approvals();
 if p_kind is null or p_kind not in ('box','dumping') or p_offset is null or p_offset<0 or p_offset>1000000 or (p_start is not null and p_end is not null and p_start>p_end) then raise exception 'Invalid filters';end if;
 with queue as (
  select b.id,p.name person,o.id order_id,o.data->>'title' title,w.data->>'description' description,j.data->>'name' job,b.quantity,coalesce(b.data->>'date',(b.created_at at time zone 'America/Chicago')::date::text) date,b.created_at from manufacturing_private.active_boxes b join public.people p on p.id=b.person_id join manufacturing_private.active_sub_jobs j on j.id=b.sub_job_id join manufacturing_private.active_work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id where p_kind='box' and b.completed_at is null
  union all
  select a.id,p.name,o.id,o.data->>'title',w.data->>'description',j.data->>'name',a.batch_quantity,(a.created_at at time zone 'America/Chicago')::date::text,a.created_at from public.dumping_assignments a join public.people p on p.id=a.person_id join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id join manufacturing_private.active_work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id where p_kind='dumping' and a.active
 ),filtered as (
 select * from queue where (p_start is null or date>=p_start::text) and (p_end is null or date<=p_end::text) and concat_ws(' ',id,person,order_id,title,description,job) ilike '%'||coalesce(p_search,'')||'%'
 ) select (select count(*) from filtered),coalesce((select jsonb_agg(to_jsonb(page) order by created_at,id) from (select * from filtered order by created_at,id limit 50 offset p_offset) page),'[]') into total,rows;
 return jsonb_build_object('total',total,'rows',rows);
end$function$
;

-- manufacturing_private.reusable_barcode(text)
CREATE OR REPLACE FUNCTION manufacturing_private.reusable_barcode(p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.dumping_assignments;
begin
 select * into a from public.dumping_assignments where id=upper(trim(p_id));
 if not found then raise exception 'Reusable barcode not found';end if;
 perform manufacturing_private.dumping_access(a.sub_job_id,false);
 return jsonb_build_object('remainingBillableUnits',(select greatest(0,j.total_billable_units-coalesce(j.billable_units_completed,0)-coalesce((select sum(b.quantity) from manufacturing_private.active_boxes b where b.sub_job_id=j.id and b.completed_at is null),0)) from manufacturing_private.active_sub_jobs j where j.id=a.sub_job_id),'billableMode',(select o.total_billable_units is not null from manufacturing_private.active_sub_jobs j join manufacturing_private.active_work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id where j.id=a.sub_job_id),'id',a.id,'personId',a.person_id,'batchQuantity',coalesce((select w.scan_pieces from manufacturing_private.active_work_orders w join manufacturing_private.active_sub_jobs j on j.work_order_id=w.id where j.id=a.sub_job_id),a.batch_quantity),'workDate',a.work_date);
end$function$
;

-- manufacturing_private.approve_barcodes(text,text[],uuid,text)
CREATE OR REPLACE FUNCTION manufacturing_private.approve_barcodes(p_kind text, p_ids text[], p_request uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare ids text[];receipt public.barcode_approval_batches;b public.boxes;a public.dumping_assignments;j public.sub_jobs;oid text;changed integer:=0;skipped integer:=0;pieces integer:=0;result jsonb;begin
 perform manufacturing_private.require_admin_approvals();
 select array_agg(distinct x order by x) into ids from unnest(p_ids) x;
 if p_request is null or coalesce(cardinality(ids),0)<1 or cardinality(ids)>100 or p_kind is null or p_kind not in ('box','dumping') or length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>500 then raise exception 'Select 1–100 codes and enter an approval reason (3–500 characters)';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into receipt from public.barcode_approval_batches where id=p_request;
 if found then
  if receipt.actor_id<>auth.uid() or receipt.kind<>p_kind or receipt.ids<>ids or receipt.reason<>trim(p_reason) then raise exception 'Approval request reference already used';end if;
  return receipt.outcome||jsonb_build_object('duplicate',true);
 end if;
 if p_kind='box' then
  if exists(select 1 from unnest(ids) x where not exists(select 1 from manufacturing_private.active_boxes where id=x)) then raise exception 'One or more box codes no longer exist';end if;
  perform 1 from public.orders where id in (select w.order_id from manufacturing_private.active_boxes bx join manufacturing_private.active_sub_jobs sj on sj.id=bx.sub_job_id join manufacturing_private.active_work_orders w on w.id=sj.work_order_id where bx.id=any(ids)) order by id for update;
  for b in select * from manufacturing_private.active_boxes where id=any(ids) order by id for update loop
   if b.completed_at is not null then skipped:=skipped+1;continue;end if;
   select * into j from manufacturing_private.active_sub_jobs where id=b.sub_job_id for update;
   if j.completed+b.quantity>j.quantity then raise exception 'Box % exceeds the remaining sub-job quantity. No codes in this batch were changed.',b.id;end if;
   select order_id into oid from manufacturing_private.active_work_orders where id=j.work_order_id;
   update public.boxes set completed_pieces=quantity,completed_at=now() where id=b.id;
   update public.sub_jobs set completed=completed+b.quantity where id=j.id;
   update public.bookings set status='completed' where id=b.id;
   insert into public.production_records(box_id,completed_pieces,actor_id) values(b.id,b.quantity,auth.uid());
   update public.orders set revision=revision+1,updated_at=now() where id=oid;
   insert into public.order_events(order_id,actor_id,message) values(oid,auth.uid(),'Admin approved box '||b.id||' complete: '||b.quantity||' pieces. Reason: '||trim(p_reason));
   changed:=changed+1;pieces:=pieces+b.quantity;
  end loop;
 else
  if exists(select 1 from unnest(ids) x where not exists(select 1 from public.dumping_assignments where id=x)) then raise exception 'One or more reusable codes no longer exist';end if;
  perform 1 from public.orders where id in (select w.order_id from public.dumping_assignments da join manufacturing_private.active_sub_jobs sj on sj.id=da.sub_job_id join manufacturing_private.active_work_orders w on w.id=sj.work_order_id where da.id=any(ids)) order by id for update;
  for a in select * from public.dumping_assignments where id=any(ids) order by id for update loop
   if not a.active then skipped:=skipped+1;continue;end if;
   select w.order_id into oid from manufacturing_private.active_sub_jobs sj join manufacturing_private.active_work_orders w on w.id=sj.work_order_id where sj.id=a.sub_job_id;
   update public.dumping_assignments set active=false where id=a.id;
   update public.orders set revision=revision+1,updated_at=now() where id=oid;
   insert into public.order_events(order_id,actor_id,message) values(oid,auth.uid(),'Admin closed reusable QR '||a.id||'. No pieces added. Reason: '||trim(p_reason));
   changed:=changed+1;
  end loop;
 end if;
 result:=jsonb_build_object('changed',changed,'skipped',skipped,'pieces',pieces,'duplicate',false);
 insert into public.barcode_approval_batches(id,actor_id,kind,ids,reason,outcome) values(p_request,auth.uid(),p_kind,ids,trim(p_reason),result);
 return result;
end$function$
;

-- manufacturing_private.scan_individual_job_qr(text,text,uuid,integer,integer)
CREATE OR REPLACE FUNCTION manufacturing_private.scan_individual_job_qr(p_code text, p_assignment text, p_request uuid, p_pieces integer, p_expected_load integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare oid text; assignment public.dumping_assignments; receipt public.dumping_completions;
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('admin','manager','coach','station','box_scanner') then
   raise exception 'Scanner access required' using errcode='42501';
 end if;
 -- Lock the order behind the displayed assignment before rechecking the plan.
 select w.order_id into oid from public.dumping_assignments a
 join public.people p on p.id=a.person_id join manufacturing_private.active_sub_jobs j on j.id=a.sub_job_id
 join manufacturing_private.active_work_orders w on w.id=j.work_order_id
 where a.id=p_assignment and p.job_qr_code=upper(trim(p_code));
 perform 1 from public.orders where id=oid for update;

 -- A retry must return the original receipt even after the individual moves to another job.
 select c.* into receipt from manufacturing_private.active_dumping_completions c
 join public.dumping_assignments a on a.id=c.assignment_id join public.people p on p.id=a.person_id
 where c.id=p_request and c.actor_id=auth.uid() and a.id=p_assignment and p.job_qr_code=upper(trim(p_code));
 if receipt.id is not null then
   return jsonb_build_object('duplicate',true,'pieces',receipt.pieces,'eventId',receipt.id,'personId',
     (select person_id from public.dumping_assignments where id=receipt.assignment_id));
 end if;

 
 perform 1 from public.people where job_qr_code=upper(trim(p_code)) for update;
 assignment:=manufacturing_private.resolve_individual_job_qr(p_code);
 if assignment.id is distinct from p_assignment then
   raise exception 'The planned job changed. Review the assignment and confirm again.' using errcode='PT409';
 end if;
 
  if assignment.personal_qr is true then
    if assignment.batch_quantity is distinct from p_expected_load then
      raise exception 'Pieces per scan changed. Review the updated load and confirm again.' using errcode='PT409';
    end if;
    return manufacturing_private.dumping_scan(assignment.id,p_request,p_pieces,true);
  end if;
  return manufacturing_private.scan_reusable_configured(assignment.id,p_request,p_pieces,p_expected_load);
end;
$function$
;

-- manufacturing_private.workspace()
CREATE OR REPLACE FUNCTION manufacturing_private.workspace()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$declare r text:=manufacturing_private.actor_role();begin
 if auth.uid() is null or r is null then raise exception 'Your account is awaiting staff approval' using errcode='42501';end if;
 if r='accounts' then raise exception 'Accounts cannot open the manufacturing workspace' using errcode='42501'; end if;
 return jsonb_build_object('orders',coalesce((select jsonb_agg(manufacturing_private.read_order(o.id) order by o.created_at desc,o.id) from public.orders o where manufacturing_private.can_read_order(o.id)),'[]'),
 'customers',case when r in ('admin','manager') then coalesce((select jsonb_agg(name order by name) from public.customers),'[]') else '[]'::jsonb end,
 
     'customerCatalog',case when r in ('admin','manager') then coalesce((
       select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'items',coalesce((
         select jsonb_agg(jsonb_build_object('id',i.id,'code',i.code,'name',i.name,'rate',i.rate,'productionDefaults',i.production_defaults,'unit',i.unit,'piecesPerUnit',i.pieces_per_unit,'revision',i.revision) order by i.name,i.code)
         from public.customer_items i where i.customer_id=c.id
       ),'[]')) order by c.name) from public.customers c
     ),'[]') else '[]'::jsonb end,
     'workforce',jsonb_build_object('people',coalesce((select jsonb_agg((case when r in ('admin','manager') and p.kind='individual' then p.data
      else p.data-array['services','billing','averageWorkingHours'] end)||jsonb_build_object('id',p.id,'name',p.name,'kind',p.kind,'hoursPerDay',p.hours_per_day) order by p.name) from public.people p),'[]'),
 'bookings',coalesce((select jsonb_agg(b.data||jsonb_build_object('id',b.id,'personId',b.person_id,'orderId',b.order_id,'workId',b.work_order_id,'start',b.starts_on,'end',b.ends_on,'hours',b.hours,'status',b.status)) from manufacturing_private.active_bookings b where manufacturing_private.can_read_order(b.order_id)),'[]')));
end$function$
;

-- manufacturing_private.save_order(jsonb,bigint,text)
CREATE OR REPLACE FUNCTION manufacturing_private.save_order(p_order jsonb, p_revision bigint, p_message text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare old public.orders;catalog_item public.customer_items;cid text;v_id text:=p_order->>'id';w jsonb;j jsonb;b jsonb;q jsonb;expected_stage integer;begin
 perform manufacturing_private.require_manager();
 if jsonb_typeof(p_order)<>'object' or v_id is null or length(trim(coalesce(p_order->>'title','')))=0 then raise exception 'Order title and reference are required';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_id,0));select * into old from public.orders where id=v_id for update;
 if old.id is not null and old.revision<>p_revision then raise exception 'This order changed on another device. Refresh and retry.' using errcode='PT409';end if;
 if old.id is null and p_revision<>0 then raise exception 'Order no longer exists';end if;
 
 if old.id is not null and p_order->'catalogRate' is distinct from old.data->'catalogRate' then
  raise exception 'Order rates are locked. Item rates are managed in Accounts.' using errcode='42501';
 end if;
 expected_stage:=(p_order->>'stage')::integer;
 if old.id is null and (expected_stage<>0 or jsonb_array_length(coalesce(p_order->'workOrders','[]'))<>0) then raise exception 'New orders must start without work orders';end if;
 if old.id is not null and (expected_stage<old.stage or expected_stage>old.stage+1) then raise exception 'Orders must move one stage at a time';end if;
 if coalesce((p_order->>'quantity')::integer,0)<1 or coalesce((p_order->>'perPack')::integer,0)<1 then raise exception 'Order quantity and pieces per pack must be positive';end if;
 if p_order->>'workOrderApprovedAt' is not null and (select coalesce(sum((value->>'quantity')::integer),0) from jsonb_array_elements(p_order->'workOrders'))<>(p_order->>'quantity')::integer then raise exception 'Work-order quantities must match the order before approval';end if;
 if old.id is not null and expected_stage>old.stage then
  if old.stage=0 and (old.data->>'assignmentConfirmedAt' is null or exists(select 1 from manufacturing_private.active_work_orders where order_id=v_id and coach_id is null) or not exists(select 1 from manufacturing_private.active_work_orders where order_id=v_id)) then raise exception 'Confirm Job Coach assignments first';end if;
  if old.stage=1 and exists(select 1 from manufacturing_private.active_sub_jobs j join manufacturing_private.active_work_orders w on w.id=j.work_order_id where w.order_id=v_id and j.completed<>j.quantity) then raise exception 'Complete every sub-job first';end if;
  if old.stage=2 and exists(select 1 from manufacturing_private.active_work_orders w where w.order_id=v_id and (select (q.data->>'failed')::integer from public.quality_checks q where q.work_order_id=w.id order by (q.data->>'at')::timestamptz desc,q.id desc limit 1) is distinct from 0) then raise exception 'Passing quality checks required';end if;
  if old.stage=3 and exists(select 1 from manufacturing_private.active_work_orders w where w.order_id=v_id and (select (q.data->>'correct')::boolean from public.packing_checks q where q.work_order_id=w.id order by (q.data->>'at')::timestamptz desc,q.id desc limit 1) is distinct from true) then raise exception 'Confirm packing checks first';end if;
  if old.stage=4 and old.data#>>'{warehouse,receivedAt}' is null then raise exception 'Warehouse receipt required';end if;
  if old.stage=5 and (old.data#>>'{delivery,dispatchedAt}' is null or old.data#>>'{delivery,signature}' is null) then raise exception 'Dispatch and customer signature required';end if;
 end if;
 select id into cid from public.customers where lower(trim(name))=lower(trim(p_order->>'customer'));
 
 if cid is null then raise exception 'Select a registered client';end if;
 if old.id is null then
   select * into catalog_item from public.customer_items
   where id::text=p_order->>'catalogItemId' and customer_id=cid;
   if not found then raise exception 'Select a registered item for this client';end if;
   p_order:=p_order||jsonb_build_object('title',catalog_item.name,'catalogItemId',catalog_item.id,'catalogCode',catalog_item.code,'catalogRate',catalog_item.rate,'catalogUnit',catalog_item.unit,'catalogPiecesPerUnit',catalog_item.pieces_per_unit);
 end if;

 insert into public.orders(id,customer_id,stage,data) values(v_id,cid,expected_stage,p_order-'workOrders'-'history'-'_revision'-'id'-'stage'-'customer')
 on conflict(id) do update set customer_id=excluded.customer_id,stage=excluded.stage,data=excluded.data,revision=orders.revision+1,updated_at=now();
 for w in select value from jsonb_array_elements(coalesce(p_order->'workOrders','[]')) loop
  if exists(select 1 from manufacturing_private.active_work_orders where id=w->>'id' and order_id<>v_id) then raise exception 'Work order belongs to another order';end if;
  if coalesce(w->>'type','') not in ('Assembly','Packing','Packaging') or coalesce((w->>'seconds')::numeric,0)<=0 then raise exception 'Invalid job type or time per piece';end if;
  if coalesce((w->>'packSeconds')::numeric,0)<0 or coalesce((w->>'hoursPerDay')::numeric,6)<=0 then raise exception 'Invalid packing time or working day';end if;
  if (select coalesce(sum((value->>'quantity')::integer),0) from jsonb_array_elements(w->'jobs'))<>(w->>'quantity')::integer then raise exception 'Sub-job pieces must match work-order quantity';end if;
  if nullif(w->>'coachId','') is not null and not exists(select 1 from public.people where id=w->>'coachId' and kind='coach') then raise exception 'Select a valid Job Coach';end if;
  perform manufacturing_private.replace_unstarted_sub_jobs(w->>'id',expected_stage,coalesce(w->'jobs','[]'),w->'replaceSubJobs'='true'::jsonb);
  insert into public.work_orders(id,order_id,coach_id,quantity,pieces_per_pack,scan_cooldown_seconds,data) values(w->>'id',v_id,nullif(w->>'coachId',''),(w->>'quantity')::integer,(w->>'perPack')::integer,coalesce((w->>'scanCooldownSeconds')::integer,120),w-'jobs'-'boxes'-'audits'-'packing'-'hasScans'-'replaceSubJobs')
  on conflict(id) do update set coach_id=excluded.coach_id,quantity=excluded.quantity,pieces_per_pack=excluded.pieces_per_pack,scan_cooldown_seconds=coalesce((w->>'scanCooldownSeconds')::integer,work_orders.scan_cooldown_seconds),data=excluded.data;
  for j in select value from jsonb_array_elements(w->'jobs') loop
   if exists(select 1 from manufacturing_private.active_sub_jobs where id=j->>'id' and work_order_id<>w->>'id') then raise exception 'Sub-job belongs to another work order';end if;
   insert into public.sub_jobs(id,work_order_id,quantity,completed,data) values(j->>'id',w->>'id',(j->>'quantity')::integer,coalesce((j->>'completed')::integer,0),j)
   on conflict(id) do update set quantity=excluded.quantity,completed=excluded.completed,data=excluded.data;
  end loop;
  -- Box creation/completion has its own locked API. A stale generic save cannot alter boxes.
  if coalesce(w->'boxes','[]')<>coalesce((select jsonb_agg(x order by x->>'id') from jsonb_array_elements(coalesce(manufacturing_private.read_order(v_id)->'workOrders','[]')) f cross join lateral jsonb_array_elements(coalesce(f->'boxes','[]')) x where f->>'id'=w->>'id'),'[]') then
   -- compare only IDs here: scanner quantities remain authoritative in boxes.
   if exists(select 1 from jsonb_array_elements(coalesce(w->'boxes','[]')) x where not exists(select 1 from manufacturing_private.active_boxes b where b.id=x->>'id')) then raise exception 'Create boxes through the box assignment API';end if;
  end if;
  for q in select value from jsonb_array_elements(coalesce(w->'audits','[]')) loop
   if (q->>'mode') not in ('Random Audit','100% Check') or (q->>'inspected')::integer<1 or (q->>'inspected')::integer>(w->>'quantity')::integer or (q->>'failed')::integer<0 or (q->>'failed')::integer>(q->>'inspected')::integer or ((q->>'mode')='100% Check' and (q->>'inspected')::integer<>(w->>'quantity')::integer) then raise exception 'Invalid quality-check quantities';end if;
   insert into public.quality_checks(id,work_order_id,data) values(q->>'id',w->>'id',q) on conflict(id) do nothing;
  end loop;
  for q in select value from jsonb_array_elements(coalesce(w->'packing','[]')) loop insert into public.packing_checks(id,work_order_id,data) values(q->>'id',w->>'id',q) on conflict(id) do nothing;end loop;
 end loop;
 if exists(select 1 from manufacturing_private.active_work_orders where order_id=v_id and id not in(select value->>'id' from jsonb_array_elements(coalesce(p_order->'workOrders','[]')))) then raise exception 'Removing saved work orders is not supported';end if;
 if old.id is not null and old.stage>0 and exists(select 1 from manufacturing_private.active_sub_jobs j join manufacturing_private.active_work_orders w on w.id=j.work_order_id where w.order_id=v_id and j.completed<coalesce((select sum(completed_pieces) from manufacturing_private.active_boxes where sub_job_id=j.id),0)+coalesce((select sum(c.pieces) from manufacturing_private.active_dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id where a.sub_job_id=j.id),0)) then raise exception 'Completed pieces cannot be less than scanned boxes';end if;
 insert into public.order_events(order_id,actor_id,message) values(v_id,auth.uid(),left(coalesce(p_message,'Order updated'),500));
 return manufacturing_private.workspace();end$function$
;

-- manufacturing_private.approve_day_plan_group(date,text,text[],uuid)
CREATE OR REPLACE FUNCTION manufacturing_private.approve_day_plan_group(p_date date, p_job text, p_expected text[], p_plan uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 oid text;
 actual text[];
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('admin','manager','coach','station','box_setup') then
   raise exception 'Plan approval requires box setup permissions' using errcode='42501';
 end if;
 if p_date is null or not isfinite(p_date) or p_date<(now() at time zone 'America/Chicago')::date then
   raise exception 'Select today or a future work date';
 end if;
 perform manufacturing_private.dumping_access(p_job,true);
 select w.order_id into oid from manufacturing_private.active_sub_jobs j join manufacturing_private.active_work_orders w on w.id=j.work_order_id where j.id=p_job;
 perform 1 from public.orders where id=oid for update;
 perform pg_advisory_xact_lock(hashtextextended('day-plan:'||p_date::text,0));
 if not exists (
   select 1 from manufacturing_private.active_sub_jobs j join manufacturing_private.active_work_orders w on w.id=j.work_order_id
   join public.orders o on o.id=w.order_id where j.id=p_job and o.stage=1 and j.completed<j.quantity
 ) then raise exception 'Select an unfinished sub-job in production'; end if;
 select array_agg(id order by id) into actual from public.dumping_assignments
 where sub_job_id=p_job and work_date=p_date and plan_id is not distinct from p_plan and active;
 if actual is null or actual is distinct from p_expected then
   raise exception 'This plan changed on another device. Refresh and review it.' using errcode='PT409';
 end if;
 if exists (
   select 1 from public.dumping_assignments a join public.people p on p.id=a.person_id
   where a.id=any(actual) and p.data->>'active'='false'
 ) then raise exception 'Remove inactive individuals before approving this plan'; end if;
 update public.dumping_assignments set plan_approved_at=now()
 where id=any(actual) and plan_approved_at is null;
 return manufacturing_private.day_plan(p_date);
end;
$function$
;

-- manufacturing_private.complete_box(text,integer)
CREATE OR REPLACE FUNCTION manufacturing_private.complete_box(p_box_id text, p_pieces integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare b public.boxes;j public.sub_jobs;w public.work_orders;o public.orders;r text:=manufacturing_private.actor_role();begin
 if auth.uid() is null or r is null then raise exception 'Staff access required' using errcode='42501';end if;
 if r not in ('admin','manager','coach','station','box_scanner') then raise exception 'Box scanning access required' using errcode='42501';end if;
 select wo.* into w from manufacturing_private.active_work_orders wo join manufacturing_private.active_sub_jobs sj on sj.work_order_id=wo.id join manufacturing_private.active_boxes bx on bx.sub_job_id=sj.id where bx.id=p_box_id;
 select * into o from public.orders where id=w.order_id for update;select * into b from manufacturing_private.active_boxes where id=p_box_id for update;select * into j from manufacturing_private.active_sub_jobs where id=b.sub_job_id for update;
 if b.id is null then raise exception 'Box code not found';end if;
 if o.stage<>1 then raise exception 'Order is not in production';end if;
 if r='coach' and not manufacturing_private.coach_can_manage_work(w.id) then raise exception 'Work order is not assigned to you' using errcode='42501';end if;
 if b.completed_at is not null then raise exception 'This box is already completed';end if;
 if p_pieces<0 or p_pieces>b.quantity or p_pieces+j.completed>j.quantity then raise exception 'Invalid completed-piece quantity';end if;
 update public.boxes set completed_pieces=p_pieces,completed_at=now() where id=b.id;
 update public.sub_jobs set completed=completed+p_pieces where id=j.id;
 update public.bookings set status='completed' where id=b.id;
 insert into public.production_records(box_id,completed_pieces,actor_id) values(b.id,p_pieces,auth.uid());
 update public.orders set revision=revision+1,updated_at=now() where id=o.id;
 insert into public.order_events(order_id,actor_id,message) values(o.id,auth.uid(),'Box '||b.id||' completed: '||p_pieces||' pieces.');return manufacturing_private.workspace();end$function$
;

CREATE OR REPLACE FUNCTION manufacturing_private.accumulate_billable_scan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare jid text; delta integer;
begin
 delta:=coalesce(case when tg_op<>'DELETE' and new.active then new.billable_units end,0)-coalesce(case when tg_op<>'INSERT' and old.active then old.billable_units end,0);
 if delta=0 then return null;end if;
 if tg_table_name='dumping_completions' then
  select sub_job_id into jid from public.dumping_assignments where id=case when tg_op='DELETE' then old.assignment_id else new.assignment_id end;
 else
  select sub_job_id into jid from public.boxes where id=case when tg_op='DELETE' then old.box_id else new.box_id end;
 end if;
 update public.sub_jobs set billable_units_completed=coalesce(billable_units_completed,0)+delta where id=jid and total_billable_units is not null;
 return null;
end $function$
;

-- An empty/deactivated plan cannot be reopened by saving a new member into its old ID.
create table manufacturing_private.deactivated_plans(
 job_id text not null,work_date date not null,plan_key text not null,
 deactivated_at timestamptz not null default clock_timestamp(),deactivated_by uuid,
 reason text not null default 'Plan permanently deactivated',primary key(job_id,work_date,plan_key)
);
alter table manufacturing_private.deactivated_plans enable row level security;
revoke all on manufacturing_private.deactivated_plans from public,anon,authenticated,service_role;

create function manufacturing_private.record_activity(p_view text,p_key text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tbl text; key text:=p_key; result jsonb;begin
 tbl:=case p_view
 when 'work_orders' then 'work_orders' when 'sub_jobs' then 'sub_jobs' when 'boxes' then 'boxes'
 when 'bookings' then 'bookings' when 'dumping_assignments' then 'dumping_assignments'
 when 'scans' then case when p_key like 'box:%' then 'production_records' else 'dumping_completions' end
 when 'production_records' then 'production_records' when 'dumping_completions' then 'dumping_completions' end;
 if tbl is null then return jsonb_build_object('active',true);end if;
 if tbl in ('production_records','dumping_completions') then key:=regexp_replace(key,'^(box:|reusable:)','');end if;
 execute format('select jsonb_build_object(''active'',active,''at'',deactivated_at,''by'',deactivated_by,''reason'',deactivation_reason) from public.%I where id::text=$1',tbl) into result using key;
 return coalesce(result,jsonb_build_object('active',true));
end$$;
revoke all on function manufacturing_private.record_activity(text,text) from public,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION manufacturing_private.configuration_history_status(p_view text, p_start date, p_end date, p_search text, p_offset integer, p_state text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 headings text[];
 source_sql text;
 result jsonb;
begin
 perform manufacturing_private.require_admin_approvals();
 if p_state is null or p_state not in ('active','inactive','all') then raise exception 'Select Active, Inactive or All';end if;
 if (p_start is not null and not isfinite(p_start)) or (p_end is not null and not isfinite(p_end))
   or p_start>p_end or length(coalesce(p_search,''))>160
   or p_offset is null or p_offset not between 0 and 1000000 then
   raise exception 'Check the history filters';
 end if;

 case p_view
 when 'scans' then
   headings:=array['Time (Tulsa)', 'Individual', 'Order / item code', 'System ID', 'Order number', 'Work order', 'Sub-job', 'QR code', 'Type', 'Source', 'Legacy pieces', 'Billable units', 'Unit'];
   source_sql:=$view$
     select e.id as row_key,(e.completed_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(to_char(e.completed_at at time zone 'America/Chicago','HH24:MI:SS'),p.name,concat_ws(' · ',o.data->>'title',nullif(o.data->>'catalogCode','')),o.id,o.data->>'orderNumber',w.id,j.data->>'name',e.qr,e.kind,e.source,case when e.billable_units is null then e.pieces end,e.billable_units,e.billable_unit_label) as cells,e.completed_at as sort_at
     from (select 'box:'||r.id as id,r.completed_at,b.person_id,b.sub_job_id,b.id qr,r.completed_pieces pieces,r.billable_units,r.billable_unit_label,
          case when exists(select 1 from public.barcode_approval_batches a
            where a.actor_id=r.actor_id and a.created_at=r.completed_at and a.kind='box' and b.id=any(a.ids))
          then 'Admin approval' else 'Scan' end source,'Single-use' kind
        from public.production_records r join public.boxes b on b.id=r.box_id
        union all
        select 'reusable:'||c.id,c.completed_at,a.person_id,a.sub_job_id,a.id,c.pieces,c.billable_units,c.billable_unit_label,'Scan','Reusable'
        from public.dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id) e join public.people p on p.id=e.person_id
      join public.sub_jobs j on j.id=e.sub_job_id
      join public.work_orders w on w.id=j.work_order_id
      join public.orders o on o.id=w.order_id
   $view$;
 when 'customers' then
   headings:=array['Client ID', 'Client'];
   source_sql:=$view$
     select c.id as row_key,(c.created_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(c.id,c.name) as cells,c.created_at as sort_at
     from public.customers c
   $view$;
 when 'customer_items' then
   headings:=array['Client', 'Item code', 'Item', 'Rate'];
   source_sql:=$view$
     select i.id::text as row_key,null::date as event_date,
       jsonb_build_array(c.name,i.code,i.name,i.rate) as cells,null::timestamptz as sort_at
     from public.customer_items i join public.customers c on c.id=i.customer_id
   $view$;
 when 'orders' then
   headings:=array['System ID', 'Order number', 'Order / item code', 'Client', 'Stage', 'Pieces', 'Pieces per pack', 'Required delivery'];
   source_sql:=$view$
     select o.id as row_key,(o.created_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(o.id,o.data->>'orderNumber',concat_ws(' · ',o.data->>'title',nullif(o.data->>'catalogCode','')),c.name,
        case o.stage when 0 then case when o.data->>'assignmentConfirmedAt' is not null then 'Plan Production'
          when o.data->>'workOrderApprovedAt' is not null or exists(select 1 from public.work_orders w where w.order_id=o.id)
          then 'Work Orders' else 'Order Requests' end
          when 1 then 'Plan Production' when 2 then 'Quality Check & Packing' when 3 then 'Quality Check & Packing'
          when 4 then 'Warehouse & Ready for Delivery' when 5 then 'Warehouse & Ready for Delivery' else 'Mark Complete' end,
        o.data->>'quantity',o.data->>'perPack',o.data->>'required') as cells,o.created_at as sort_at
     from public.orders o join public.customers c on c.id=o.customer_id
   $view$;
 when 'work_orders' then
   headings:=array['Work order', 'System ID', 'Order / item code', 'Description', 'Job type', 'Job Coach', 'Pieces', 'Pieces per pack', 'Pieces per scan', 'Scan delay (s)'];
   source_sql:=$view$
     select w.id as row_key,coalesce(nullif(w.data->>'startDate','')::date,(o.created_at at time zone 'America/Chicago')::date) as event_date,
       jsonb_build_array(w.id,o.id,concat_ws(' · ',o.data->>'title',nullif(o.data->>'catalogCode','')),w.data->>'description',w.data->>'type',p.name,w.quantity,w.pieces_per_pack,w.scan_pieces,w.scan_cooldown_seconds) as cells,null::timestamptz as sort_at
     from public.work_orders w join public.orders o on o.id=w.order_id left join public.people p on p.id=w.coach_id
   $view$;
 when 'sub_jobs' then
   headings:=array['Sub-job ID', 'Sub-job', 'Work order', 'System ID', 'Order / item code', 'Target pieces', 'Completed pieces', 'Pack type'];
   source_sql:=$view$
     select j.id as row_key,coalesce(nullif(w.data->>'startDate','')::date,(o.created_at at time zone 'America/Chicago')::date) as event_date,
       jsonb_build_array(j.id,j.data->>'name',w.id,o.id,concat_ws(' · ',o.data->>'title',nullif(o.data->>'catalogCode','')),j.quantity,j.completed,j.data->>'packType') as cells,null::timestamptz as sort_at
     from public.sub_jobs j join public.work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id
   $view$;
 when 'boxes' then
   headings:=array['QR code', 'Individual', 'System ID', 'Sub-job', 'Assigned pieces', 'Completed pieces', 'Completed date'];
   source_sql:=$view$
     select b.id as row_key,(b.created_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(b.id,p.name,w.order_id,j.data->>'name',b.quantity,b.completed_pieces,(b.completed_at at time zone 'America/Chicago')::date) as cells,b.created_at as sort_at
     from public.boxes b join public.people p on p.id=b.person_id join public.sub_jobs j on j.id=b.sub_job_id join public.work_orders w on w.id=j.work_order_id
   $view$;
 when 'production_records' then
   headings:=array['Time (Tulsa)', 'Individual', 'Order / item code', 'System ID', 'Order number', 'Work order', 'Sub-job', 'QR code', 'Type', 'Source', 'Legacy pieces', 'Billable units', 'Unit'];
   source_sql:=$view$
     select e.id as row_key,(e.completed_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(to_char(e.completed_at at time zone 'America/Chicago','HH24:MI:SS'),p.name,concat_ws(' · ',o.data->>'title',nullif(o.data->>'catalogCode','')),o.id,o.data->>'orderNumber',w.id,j.data->>'name',e.qr,e.kind,e.source,case when e.billable_units is null then e.pieces end,e.billable_units,e.billable_unit_label) as cells,e.completed_at as sort_at
     from (select 'box:'||r.id as id,r.completed_at,b.person_id,b.sub_job_id,b.id qr,r.completed_pieces pieces,r.billable_units,r.billable_unit_label,
          case when exists(select 1 from public.barcode_approval_batches a
            where a.actor_id=r.actor_id and a.created_at=r.completed_at and a.kind='box' and b.id=any(a.ids))
          then 'Admin approval' else 'Scan' end source,'Single-use' kind
        from public.production_records r join public.boxes b on b.id=r.box_id) e join public.people p on p.id=e.person_id
      join public.sub_jobs j on j.id=e.sub_job_id
      join public.work_orders w on w.id=j.work_order_id
      join public.orders o on o.id=w.order_id
   $view$;
 when 'dumping_assignments' then
   headings:=array['QR code', 'Individual', 'System ID', 'Sub-job', 'Plan ID', 'Pieces per scan', 'Active', 'Approved'];
   source_sql:=$view$
     select a.id as row_key,coalesce(a.work_date,(a.created_at at time zone 'America/Chicago')::date) as event_date,
       jsonb_build_array(a.id,p.name,w.order_id,j.data->>'name',a.plan_id,coalesce(w.scan_pieces,a.batch_quantity),a.active,a.plan_approved_at is not null) as cells,null::timestamptz as sort_at
     from public.dumping_assignments a join public.people p on p.id=a.person_id join public.sub_jobs j on j.id=a.sub_job_id join public.work_orders w on w.id=j.work_order_id
   $view$;
 when 'dumping_completions' then
   headings:=array['Time (Tulsa)', 'Individual', 'Order / item code', 'System ID', 'Order number', 'Work order', 'Sub-job', 'QR code', 'Type', 'Source', 'Legacy pieces', 'Billable units', 'Unit'];
   source_sql:=$view$
     select e.id as row_key,(e.completed_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(to_char(e.completed_at at time zone 'America/Chicago','HH24:MI:SS'),p.name,concat_ws(' · ',o.data->>'title',nullif(o.data->>'catalogCode','')),o.id,o.data->>'orderNumber',w.id,j.data->>'name',e.qr,e.kind,e.source,case when e.billable_units is null then e.pieces end,e.billable_units,e.billable_unit_label) as cells,e.completed_at as sort_at
     from (select 'reusable:'||c.id as id,c.completed_at,a.person_id,a.sub_job_id,a.id as qr,c.pieces,c.billable_units,c.billable_unit_label,'Scan' as source,'Reusable' as kind
        from public.dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id) e join public.people p on p.id=e.person_id
      join public.sub_jobs j on j.id=e.sub_job_id
      join public.work_orders w on w.id=j.work_order_id
      join public.orders o on o.id=w.order_id
   $view$;
 when 'people' then
   headings:=array['Individual ID', 'Name', 'Type', 'Role / skills', 'Hours per day', 'Weekly hours (Mon–Sun)', 'Active'];
   source_sql:=$view$
     select p.id as row_key,null::date as event_date,
       jsonb_build_array(p.id,p.name,p.kind,p.data->>'role',p.hours_per_day,p.data->'weeklyHours',p.data->>'active' is distinct from 'false') as cells,null::timestamptz as sort_at
     from public.people p
   $view$;
 when 'staff_profiles' then
   headings:=array['Name', 'Role', 'Linked individual', 'Active'];
   source_sql:=$view$
     select s.id::text as row_key,(s.created_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(s.display_name,s.role,p.name,s.active) as cells,s.created_at as sort_at
     from public.staff_profiles s left join public.people p on p.id=s.person_id
   $view$;
 when 'bookings' then
   headings:=array['Booking ID', 'Individual', 'System ID', 'Work order', 'End date', 'Hours', 'Status'];
   source_sql:=$view$
     select b.id as row_key,b.starts_on as event_date,
       jsonb_build_array(b.id,p.name,b.order_id,b.work_order_id,b.ends_on,b.hours,b.status) as cells,null::timestamptz as sort_at
     from public.bookings b join public.people p on p.id=b.person_id
   $view$;
 when 'individual_availability' then
   headings:=array['Individual', 'Status', 'Hours'];
   source_sql:=$view$
     select a.person_id||a.date::text as row_key,a.date as event_date,
       jsonb_build_array(p.name,a.status,a.hours) as cells,null::timestamptz as sort_at
     from public.individual_availability a join public.people p on p.id=a.person_id
   $view$;
 when 'daily_attendance' then
   headings:=array['Individual', 'Status', 'Arrival', 'Departure', 'Work hours'];
   source_sql:=$view$
     select a.person_id||a.date::text as row_key,a.date as event_date,
       jsonb_build_array(p.name,a.status,a.arrival,a.departure,a.work_hours) as cells,null::timestamptz as sort_at
     from public.daily_attendance a join public.people p on p.id=a.person_id
   $view$;
 when 'individual_timesheets' then
   headings:=array['Individual', 'Job Coach', 'Location', 'Last updated', 'Revision'];
   source_sql:=$view$
     select t.person_id||t.week_start::text as row_key,t.week_start as event_date,
       jsonb_build_array(p.name,t.data->>'coach',t.data->>'location',(t.updated_at at time zone 'America/Chicago')::date,t.revision) as cells,null::timestamptz as sort_at
     from public.individual_timesheets t join public.people p on p.id=t.person_id
   $view$;
 when 'quality_checks' then
   headings:=array['Check ID', 'System ID', 'Work order', 'Method', 'Inspector', 'Inspected', 'Failed'];
   source_sql:=$view$
     select q.id as row_key,(nullif(q.data->>'at','')::timestamptz at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(q.id,w.order_id,w.id,q.data->>'mode',q.data->>'inspector',q.data->>'inspected',q.data->>'failed') as cells,nullif(q.data->>'at','')::timestamptz as sort_at
     from public.quality_checks q join public.work_orders w on w.id=q.work_order_id
   $view$;
 when 'packing_checks' then
   headings:=array['Check ID', 'System ID', 'Work order', 'Packed correctly', 'Notes'];
   source_sql:=$view$
     select q.id as row_key,(nullif(q.data->>'at','')::timestamptz at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(q.id,w.order_id,w.id,q.data->'correct',q.data->>'notes') as cells,nullif(q.data->>'at','')::timestamptz as sort_at
     from public.packing_checks q join public.work_orders w on w.id=q.work_order_id
   $view$;
 when 'order_events' then
   headings:=array['Time (Tulsa)', 'System ID', 'Staff', 'Event'];
   source_sql:=$view$
     select e.id::text as row_key,(e.occurred_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(to_char(e.occurred_at at time zone 'America/Chicago','HH24:MI:SS'),e.order_id,s.display_name,e.message) as cells,e.occurred_at as sort_at
     from public.order_events e left join public.staff_profiles s on s.id=e.actor_id
   $view$;
 when 'workforce_changes' then
   headings:=array['Time (Tulsa)', 'Individual', 'Staff', 'Change', 'Active'];
   source_sql:=$view$
     select c.id::text as row_key,(c.at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(to_char(c.at at time zone 'America/Chicago','HH24:MI:SS'),p.name,s.display_name,c.kind,c.data->'active') as cells,c.at as sort_at
     from public.workforce_changes c left join public.people p on p.id=c.person_id left join public.staff_profiles s on s.id=c.actor_id
   $view$;
 when 'barcode_approval_batches' then
   headings:=array['Time (Tulsa)', 'Staff', 'Type', 'QR codes', 'Reason', 'Changed', 'Skipped', 'Pieces'];
   source_sql:=$view$
     select b.id::text as row_key,(b.created_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(to_char(b.created_at at time zone 'America/Chicago','HH24:MI:SS'),s.display_name,b.kind,b.ids,b.reason,b.outcome->>'changed',b.outcome->>'skipped',b.outcome->>'pieces') as cells,b.created_at as sort_at
     from public.barcode_approval_batches b left join public.staff_profiles s on s.id=b.actor_id
   $view$;
 when 'order_schedules' then
   headings:=array['Schedule ID', 'Client', 'Order title', 'Repeat interval (days)', 'Active'];
   source_sql:=$view$
     select s.id::text as row_key,s.next_due_date as event_date,
       jsonb_build_array(s.id,c.name,s.data->>'title',s.interval_days,s.active) as cells,null::timestamptz as sort_at
     from public.order_schedules s join public.customers c on c.id=s.customer_id
   $view$;
 when 'calendar_exceptions' then
   headings:=array['Individual', 'Available hours', 'Reason'];
   source_sql:=$view$
     select e.id::text as row_key,e.date as event_date,
       jsonb_build_array(p.name,e.available_hours,e.reason) as cells,null::timestamptz as sort_at
     from public.calendar_exceptions e left join public.people p on p.id=e.person_id
   $view$;
 when 'calendar_settings' then
   headings:=array['Time zone', 'Working weekdays', 'Hours per day'];
   source_sql:=$view$
     select s.id::text as row_key,null::date as event_date,
       jsonb_build_array(s.timezone,s.working_weekdays,s.hours_per_day) as cells,null::timestamptz as sort_at
     from public.calendar_settings s
   $view$;
 else raise exception 'Select a supported history view';
 end case;

 headings:=headings||array['Record state','Deactivated at','Deactivated by','Reason'];
 source_sql:=format('select h.row_key,h.event_date,h.cells||jsonb_build_array(case when (a.info->>''active'')::boolean then ''Active'' else ''Inactive'' end,a.info->>''at'',a.info->>''by'',a.info->>''reason'') cells,h.sort_at from (%s) h cross join lateral (select manufacturing_private.record_activity(%L,h.row_key) info) a where %L=''all'' or ((a.info->>''active'')::boolean)=(%L=''active'')',source_sql,p_view,p_state,p_state);
 execute 'with filtered as (
   select row_key,event_date,cells,sort_at from ('||source_sql||') history
   where ($1::date is null or event_date >= $1) and ($2::date is null or event_date <= $2)
     and (coalesce(trim($3),'''')='''' or strpos(lower(cells::text),lower(trim($3)))>0)
 )
 select jsonb_build_object(''columns'',$5::text[],''total'',count(*),
   ''pieces'',case when $6::boolean then coalesce(sum((case when $6 then cells->>10 end)::bigint),0) end,
   ''rows'',
   coalesce((select jsonb_agg(to_jsonb(page) order by event_date desc nulls last,sort_at desc nulls last,row_key)
     from (select row_key,event_date,cells,sort_at from filtered order by event_date desc nulls last,sort_at desc nulls last,row_key limit 50 offset $4) page),''[]''))
 from filtered'
 into result using p_start,p_end,p_search,p_offset,headings,p_view in ('scans','production_records','dumping_completions');
 return result;
end;
$function$
;

create function public.app_configuration_history_status(p_view text,p_start date,p_end date,p_search text,p_offset integer,p_state text)
returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.configuration_history_status(p_view,p_start,p_end,p_search,p_offset,p_state);$$;
revoke all on function public.app_configuration_history_status(text,date,date,text,integer,text),manufacturing_private.configuration_history_status(text,date,date,text,integer,text) from public,anon;
grant execute on function public.app_configuration_history_status(text,date,date,text,integer,text),manufacturing_private.configuration_history_status(text,date,date,text,integer,text) to authenticated;

do $$declare d text;begin
 d:=pg_get_functiondef('manufacturing_private.configuration_history(text,date,date,text,integer)'::regprocedure);
 d:=replace(d,'a.id as qr,c.pieces,''Scan'' as source','a.id as qr,c.pieces,c.billable_units,c.billable_unit_label,''Scan'' as source');execute d;
end$$;

create trigger active_parent before insert or update of work_order_id on public.work_order_coaches for each row execute function manufacturing_private.require_active_parent('work_orders','work_order_id');
