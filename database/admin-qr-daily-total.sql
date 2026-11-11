begin;
create table public.admin_qr_daily_totals(
 request_id uuid primary key,
 actor_id uuid not null references auth.users(id),
 qr_code text not null,
 target_id text not null,
 work_date date not null,
 total integer not null check(total between 0 and 1000000),
 added integer not null check(added>=0),
 event_id uuid,
 result jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.admin_qr_daily_totals enable row level security;
revoke all on public.admin_qr_daily_totals from public,anon,authenticated;
create index admin_qr_daily_actor_idx on public.admin_qr_daily_totals(actor_id);
create index admin_qr_daily_event_idx on public.admin_qr_daily_totals(event_id) where event_id is not null;

create function manufacturing_private.admin_qr_daily_summary(p_code text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
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
     select 1 from public.dumping_completions c where c.assignment_id=a.id
      and c.completed_at>=today::timestamp at time zone 'America/Chicago'
      and c.completed_at<(today+1)::timestamp at time zone 'America/Chicago'))
   union all
   select b.id,'box',b.person_id,b.sub_job_id,b.quantity,b.completed_at,false,b.created_at,1
   from public.boxes b where b.id=code
  ), targets as (
   select c.*,j.quantity as job_quantity,j.completed as job_completed,w.order_id,
    o.stage,o.data->>'title' as title,o.data->>'catalogCode' as catalog_code,j.data->>'name' as job_name,
    p.name,
    case when c.kind='box' then (
     select coalesce(b.completed_pieces,0) from public.boxes b where b.id=c.id
       and b.completed_at>=today::timestamp at time zone 'America/Chicago'
       and b.completed_at<(today+1)::timestamp at time zone 'America/Chicago')
    else (
     select sum(dc.pieces) from public.dumping_completions dc
      join public.dumping_assignments da on da.id=dc.assignment_id
     where (da.id=c.id or (code like 'IND-%' and da.person_id=c.person_id and da.sub_job_id=c.sub_job_id))
      and dc.completed_at>=today::timestamp at time zone 'America/Chicago'
      and dc.completed_at<(today+1)::timestamp at time zone 'America/Chicago')
    end as recorded,
    (select coalesce(sum(b.quantity),0) from public.boxes b
      where b.sub_job_id=c.sub_job_id and b.completed_at is null
       and (c.kind<>'box' or b.id<>c.id)) as reserved
   from candidates c join public.sub_jobs j on j.id=c.sub_job_id
   join public.work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id
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
end $$;

create function manufacturing_private.set_qr_daily_total(
 p_code text,p_target text,p_date date,p_total integer,p_expected integer,p_request uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
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
  raise exception 'The day changed. Refresh the daily total before saving.' using errcode='40001';
 end if;
 select row into summary from jsonb_array_elements(manufacturing_private.admin_qr_daily_summary(code)) row
  where row->>'id'=p_target;
 if summary is null then raise exception 'Scan a QR assigned to work for today'; end if;
 perform 1 from public.orders where id=summary->>'orderId' for update;
 perform 1 from public.people where id=summary->>'personId' for update;
 perform 1 from public.sub_jobs where id=summary->>'jobId' for update;
 if summary->>'kind'='box' then
  perform 1 from public.boxes where id=p_target for update;
 else
  perform 1 from public.dumping_assignments where id=p_target for update;
 end if;
 select row into summary from jsonb_array_elements(manufacturing_private.admin_qr_daily_summary(code)) row
  where row->>'id'=p_target;
 if summary is null or (summary->>'recorded')::integer<>p_expected then
  raise exception 'Production changed. Refresh the daily total and review again.' using errcode='40001';
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
end $$;

create function public.app_admin_qr_daily_summary(p_code text)
returns jsonb language sql volatile security invoker set search_path='' as $$
 select manufacturing_private.admin_qr_daily_summary(p_code);
$$;
create function public.app_set_qr_daily_total(p_code text,p_target text,p_date date,p_total integer,p_expected integer,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.set_qr_daily_total(p_code,p_target,p_date,p_total,p_expected,p_request);
$$;
revoke all on function manufacturing_private.admin_qr_daily_summary(text),public.app_admin_qr_daily_summary(text),
 manufacturing_private.set_qr_daily_total(text,text,date,integer,integer,uuid),
 public.app_set_qr_daily_total(text,text,date,integer,integer,uuid) from public,anon;
grant execute on function manufacturing_private.admin_qr_daily_summary(text),public.app_admin_qr_daily_summary(text),
 manufacturing_private.set_qr_daily_total(text,text,date,integer,integer,uuid),
 public.app_set_qr_daily_total(text,text,date,integer,integer,uuid) to authenticated;
commit;
