begin;
-- Preserve existing locking, capacity, authorization and idempotency checks.
do $$declare definition text;begin
 select pg_get_functiondef('manufacturing_private.dumping_scan(text,uuid,integer)'::regprocedure) into definition;
 if position('qty>a.batch_quantity or' in definition)>0 then
  definition:=replace(definition,'qty>a.batch_quantity or','qty>2*a.batch_quantity or');
  execute definition;
 elsif position('qty>2*a.batch_quantity or' in definition)=0 then raise exception 'Unexpected dumping scan definition';end if;
end$$;
create or replace function manufacturing_private.scanner_daily_work(p_date date) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or manufacturing_private.actor_role() not in ('admin','manager','coach','station','box_scanner') or manufacturing_private.actor_role() is null then raise exception 'Scanner access required' using errcode='42501';end if;
 if p_date is null then raise exception 'Select a day';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('personId',person_id,'name',name,'pieces',pieces,'completions',completions) order by pieces desc,name,person_id) from (
 select e.person_id,p.name,sum(e.pieces) pieces,count(*) completions from (
 select b.person_id,b.completed_pieces pieces,w.order_id from public.boxes b join public.sub_jobs j on j.id=b.sub_job_id join public.work_orders w on w.id=j.work_order_id
 where b.completed_at >= (p_date::timestamp at time zone 'America/Chicago') and b.completed_at < ((p_date+1)::timestamp at time zone 'America/Chicago')
 union all
 select a.person_id,c.pieces,w.order_id from public.dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id join public.sub_jobs j on j.id=a.sub_job_id join public.work_orders w on w.id=j.work_order_id
 where c.completed_at >= (p_date::timestamp at time zone 'America/Chicago') and c.completed_at < ((p_date+1)::timestamp at time zone 'America/Chicago')
 ) e join public.people p on p.id=e.person_id where manufacturing_private.can_read_order(e.order_id)
 and (manufacturing_private.actor_role()<>'coach' or exists(select 1 from public.work_orders w join public.staff_profiles s on s.person_id=w.coach_id where w.order_id=e.order_id and s.id=auth.uid()))
 group by e.person_id,p.name) totals),'[]'::jsonb);
end$$;
create or replace function public.app_scanner_daily_work(p_date date) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.scanner_daily_work(p_date);$$;
revoke all on function manufacturing_private.scanner_daily_work(date),public.app_scanner_daily_work(date) from public,anon;
grant execute on function manufacturing_private.scanner_daily_work(date),public.app_scanner_daily_work(date) to authenticated;
commit;
