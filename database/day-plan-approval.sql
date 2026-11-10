alter table public.dumping_assignments add column if not exists plan_approved_at timestamptz;

-- Membership changes revoke approval for the entire saved date/sub-job group.
-- This runs inside the existing order and date locks.
do $patch$
declare
 definition text:=pg_get_functiondef('manufacturing_private.day_plan(date,text,text[],text[])'::regprocedure);
 membership_hook text:='-- Lock people in stable order before changing their assignments.';
 result_hook text:='''workDate'',a.work_date';
begin
 if position('plan_approved_at' in definition)=0 then
   if position(membership_hook in definition)=0 or position(result_hook in definition)=0 then
     raise exception 'Unexpected day_plan definition';
   end if;
   definition:=replace(definition,membership_hook,
     'update public.dumping_assignments set plan_approved_at=null where sub_job_id=p_job and work_date=p_date and active and plan_approved_at is not null;'||chr(10)||'     '||membership_hook);
   definition:=replace(definition,result_hook,result_hook||',''approvedAt'',a.plan_approved_at');
   execute definition;
 end if;
end
$patch$;

create or replace function manufacturing_private.approve_day_plan(p_date date,p_job text,p_expected text[])
returns jsonb language plpgsql security definer set search_path='' as $$
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
 select w.order_id into oid from public.sub_jobs j join public.work_orders w on w.id=j.work_order_id where j.id=p_job;
 perform 1 from public.orders where id=oid for update;
 perform pg_advisory_xact_lock(hashtextextended('day-plan:'||p_date::text,0));
 if not exists (
   select 1 from public.sub_jobs j join public.work_orders w on w.id=j.work_order_id
   join public.orders o on o.id=w.order_id where j.id=p_job and o.stage=1 and j.completed<j.quantity
 ) then raise exception 'Select an unfinished sub-job in production'; end if;
 select array_agg(id order by id) into actual from public.dumping_assignments
 where sub_job_id=p_job and work_date=p_date and active;
 if actual is null or actual is distinct from p_expected then
   raise exception 'This plan changed on another device. Refresh and review it.' using errcode='40001';
 end if;
 if exists (
   select 1 from public.dumping_assignments a join public.people p on p.id=a.person_id
   where a.id=any(actual) and p.data->>'active'='false'
 ) then raise exception 'Remove inactive individuals before approving this plan'; end if;
 update public.dumping_assignments set plan_approved_at=now()
 where id=any(actual) and plan_approved_at is null;
 return manufacturing_private.day_plan(p_date);
end;
$$;

create or replace function manufacturing_private.approved_day_plans(p_date date)
returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(label order by position), '[]'::jsonb)
 from jsonb_array_elements(manufacturing_private.day_plan(p_date)) with ordinality as labels(label,position)
 where p_date>=(now() at time zone 'America/Chicago')::date
   and label->>'approvedAt' is not null
   and exists (select 1 from public.people p where p.id=label->>'personId' and p.data->>'active' is distinct from 'false');
$$;

create or replace function public.app_approve_day_plan(p_date date,p_job text,p_expected text[])
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.approve_day_plan(p_date,p_job,p_expected);
$$;

create or replace function public.app_approved_day_plans(p_date date)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.approved_day_plans(p_date);
$$;

revoke all on function manufacturing_private.approve_day_plan(date,text,text[]),
 manufacturing_private.approved_day_plans(date),public.app_approve_day_plan(date,text,text[]),
 public.app_approved_day_plans(date) from public,anon;
grant execute on function manufacturing_private.approve_day_plan(date,text,text[]),
 manufacturing_private.approved_day_plans(date),public.app_approve_day_plan(date,text,text[]),
 public.app_approved_day_plans(date) to authenticated;
