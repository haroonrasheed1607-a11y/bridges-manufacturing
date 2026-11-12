begin;
create function manufacturing_private.planned_jobs(p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('admin','manager','coach','station','box_setup') then
  raise exception 'Plan access required' using errcode='42501';
 end if;
 if p_date is null or not isfinite(p_date) then raise exception 'Select a valid work date';end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object('jobId',j.id,'jobName',j.data->>'name','orderId',o.id,
   'title',o.data->>'title','code',o.data->>'catalogCode','quantity',j.quantity,'completed',j.completed,
   'piecesToday',coalesce((select sum(records.pieces) from (
    select c.pieces from public.dumping_completions c join public.dumping_assignments d on d.id=c.assignment_id
     where d.sub_job_id=j.id and c.completed_at>=p_date::timestamp at time zone 'America/Chicago'
      and c.completed_at<(p_date+1)::timestamp at time zone 'America/Chicago'
    union all
    select r.completed_pieces from public.production_records r join public.boxes b on b.id=r.box_id
     where b.sub_job_id=j.id and r.completed_at>=p_date::timestamp at time zone 'America/Chicago'
      and r.completed_at<(p_date+1)::timestamp at time zone 'America/Chicago'
   ) records),0),
   'approvalId',a.id,'approvedAt',a.approved_at,
   'canComplete',a.id is not null and a.revoked_at is null and a.completed_at is null and j.completed<j.quantity and o.stage=1,
   'status',case when a.completed_at is not null or j.completed>=j.quantity then 'Completed'
     when a.revoked_at is not null then 'Revoked' when o.stage<>1 then 'Moved on'
     when a.id is not null then 'Ready for production' else 'Planned' end
  ) order by o.created_at desc,o.id,j.id)
  from public.sub_jobs j join public.work_orders w on w.id=j.work_order_id
  join public.orders o on o.id=w.order_id
  left join public.scan_assign_approvals a on a.sub_job_id=j.id and a.work_date=p_date
  where manufacturing_private.can_read_order(o.id)
   and (manufacturing_private.actor_role()<>'coach' or manufacturing_private.coach_can_manage_work(w.id))
   and (a.id is not null or exists(select 1 from public.dumping_assignments d
    where d.sub_job_id=j.id and d.work_date=p_date and (d.active or exists(select 1 from public.dumping_completions c where c.assignment_id=d.id))))
 ),'[]'::jsonb);
end $$;
create function public.app_planned_jobs(p_date date)
returns jsonb language sql stable security invoker set search_path='' as $$
 select manufacturing_private.planned_jobs(p_date);
$$;
revoke all on function manufacturing_private.planned_jobs(date),public.app_planned_jobs(date) from public,anon;
grant execute on function manufacturing_private.planned_jobs(date),public.app_planned_jobs(date) to authenticated;
commit;
