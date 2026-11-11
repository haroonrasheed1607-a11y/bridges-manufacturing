create function manufacturing_private.shop_floor_dashboard(p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r text:=manufacturing_private.actor_role();
begin
 if auth.uid() is null or coalesce(r,'') not in ('admin','manager','coach','station','box_setup','box_scanner') then
   raise exception 'Shop Floor access required' using errcode='42501';
 end if;
 if p_date is null or not isfinite(p_date) then raise exception 'Choose a valid date'; end if;
 return (
   with accessible_work as (
     select w.id,w.order_id from public.work_orders w
     where manufacturing_private.can_read_order(w.order_id)
       and (r<>'coach' or w.coach_id=(select person_id from public.staff_profiles where id=auth.uid()))
   ), scanned as (
     select w.order_id,records.completed_pieces as pieces
     from public.production_records records join public.boxes b on b.id=records.box_id
     join public.sub_jobs j on j.id=b.sub_job_id join accessible_work w on w.id=j.work_order_id
     where records.completed_at>=(p_date::timestamp at time zone 'America/Chicago')
       and records.completed_at<((p_date+1)::timestamp at time zone 'America/Chicago')
       and not exists(select 1 from public.barcode_approval_batches approval
         where approval.actor_id=records.actor_id and approval.created_at=records.completed_at
           and approval.kind='box' and b.id=any(approval.ids))
     union all
     select w.order_id,c.pieces
     from public.dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id
     join public.sub_jobs j on j.id=a.sub_job_id join accessible_work w on w.id=j.work_order_id
     where c.completed_at>=(p_date::timestamp at time zone 'America/Chicago')
       and c.completed_at<((p_date+1)::timestamp at time zone 'America/Chicago')
   ), totals as (
     select order_id,sum(pieces) as pieces from scanned group by order_id
   ), eligible as (
     select order_id from totals
     union
     select w.order_id from public.scan_assign_approvals a
       join public.sub_jobs j on j.id=a.sub_job_id join accessible_work w on w.id=j.work_order_id
       join public.orders o on o.id=w.order_id
     where a.work_date=p_date and a.revoked_at is null and o.stage=1
     union
     select w.order_id from public.dumping_assignments a
       join public.sub_jobs j on j.id=a.sub_job_id join accessible_work w on w.id=j.work_order_id
       join public.orders o on o.id=w.order_id
     where a.work_date=p_date and a.active and a.plan_approved_at is not null and o.stage=1
   )
   select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'title',o.data->>'title',
     'code',o.data->>'catalogCode','pieces',coalesce(t.pieces,0))
     order by coalesce(t.pieces,0) desc,o.data->>'title',o.id),'[]'::jsonb)
   from eligible e join public.orders o on o.id=e.order_id
   left join totals t on t.order_id=o.id
 );
end $$;

create function public.app_shop_floor_dashboard(p_date date)
returns jsonb language sql stable security invoker set search_path='' as $$
 select manufacturing_private.shop_floor_dashboard(p_date);
$$;
revoke all on function manufacturing_private.shop_floor_dashboard(date),public.app_shop_floor_dashboard(date) from public,anon;
grant execute on function manufacturing_private.shop_floor_dashboard(date),public.app_shop_floor_dashboard(date) to authenticated;
