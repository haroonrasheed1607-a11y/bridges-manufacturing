create or replace function manufacturing_private.discard_work_order(
 p_order text,p_work text,p_revision bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
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
   raise exception 'This order changed on another device. Refresh and retry.' using errcode='40001';
 end if;
 select * into target from public.work_orders where id=p_work and order_id=p_order for update;
 if target.id is null then raise exception 'Work order no longer exists'; end if;
 if current_order.stage not in (0,1) or manufacturing_private.work_order_has_scans(p_work)
   or exists(select 1 from public.sub_jobs where work_order_id=p_work and completed>0)
   or exists(select 1 from public.quality_checks where work_order_id=p_work)
   or exists(select 1 from public.packing_checks where work_order_id=p_work)
   or exists(select 1 from public.bookings where work_order_id=p_work and status='completed')
 then raise exception 'Work has been recorded. This work order cannot be discarded.'; end if;

 -- Removing an allocation requires the order to be re-approved. Protect any
 -- sibling work already underway from being sent back to planning.
 if exists (
   select 1 from public.work_orders w where w.order_id=p_order and w.id<>p_work and (
     manufacturing_private.work_order_has_scans(w.id)
     or exists(select 1 from public.sub_jobs j where j.work_order_id=w.id and j.completed>0)
   )
 ) then raise exception 'Other work on this order has started. Its production allocation cannot be reopened.'; end if;

 delete from public.boxes b using public.sub_jobs j where b.sub_job_id=j.id and j.work_order_id=p_work;
 delete from public.dumping_assignments a using public.sub_jobs j where a.sub_job_id=j.id and j.work_order_id=p_work;
 delete from public.bookings where work_order_id=p_work;
 delete from public.work_orders where id=p_work;

 select max(nullif(data->>'expected','')) into next_expected from public.work_orders where order_id=p_order;
 update public.orders set stage=0,revision=revision+1,updated_at=now(),
   data=(data-'workOrderApprovedAt'-'assignmentConfirmedAt'-'productionStartedAt')||
     jsonb_build_object('expected',next_expected)
 where id=p_order;
 insert into public.order_events(order_id,actor_id,message) values(p_order,auth.uid(),
   format('Discarded unstarted work order %s (%s pieces). Its QR labels and bookings were retired.',target.id,target.quantity));
 return manufacturing_private.workspace();
end;
$$;

create or replace function public.app_discard_work_order(p_order text,p_work text,p_revision bigint)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.discard_work_order(p_order,p_work,p_revision);
$$;
revoke all on function manufacturing_private.discard_work_order(text,text,bigint),
 public.app_discard_work_order(text,text,bigint) from public,anon;
grant execute on function manufacturing_private.discard_work_order(text,text,bigint),
 public.app_discard_work_order(text,text,bigint) to authenticated;
