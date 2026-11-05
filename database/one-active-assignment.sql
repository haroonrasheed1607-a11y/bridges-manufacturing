begin;
create index if not exists boxes_open_person_idx on public.boxes(person_id) where completed_at is null;
create function manufacturing_private.require_person_free(p_person text,p_existing text default null) returns void language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.people where id=p_person and kind='individual' and coalesce(data->>'active','true')<>'false' for update;
 if not found then raise exception 'Select an active individual';end if;
 if exists(select 1 from public.boxes where person_id=p_person and completed_at is null and id is distinct from p_existing)
 or exists(select 1 from public.dumping_assignments a join public.sub_jobs j on j.id=a.sub_job_id join public.work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id where a.person_id=p_person and a.active and j.completed<j.quantity and o.stage=1 and a.id is distinct from p_existing) then
 raise exception 'This individual already has work. Complete the current box or close the reusable assignment before creating another barcode.';
 end if;
end$$;
revoke all on function manufacturing_private.require_person_free(text,text) from public,anon,authenticated;
-- Both creation APIs take the same individual row lock, serializing concurrent assignments across orders.
do $$declare definition text;begin
 select pg_get_functiondef('manufacturing_private.create_box(text,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'if extract(isodow from (p_box->>''date'')::date)>5','perform manufacturing_private.require_person_free(p_box->>''personId''); if extract(isodow from (p_box->>''date'')::date)>5');
 execute definition;
 select pg_get_functiondef('manufacturing_private.dumping_assign(text,text,text,integer)'::regprocedure) into definition;
 definition:=replace(definition,'insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,created_by)','perform manufacturing_private.require_person_free(p_person,p_id); insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,created_by)');
 execute definition;
end$$;
create function manufacturing_private.person_current_work(p_person text) returns jsonb language plpgsql security definer set search_path='' as $$declare r text:=manufacturing_private.actor_role();items jsonb;occupied boolean;begin
 if auth.uid() is null or coalesce(r,'') not in ('admin','manager','coach','station','box_setup') then raise exception 'Box setup access required' using errcode='42501';end if;
 select exists(select 1 from public.boxes where person_id=p_person and completed_at is null) or exists(select 1 from public.dumping_assignments a join public.sub_jobs j on j.id=a.sub_job_id join public.work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id where a.person_id=p_person and a.active and j.completed<j.quantity and o.stage=1) into occupied;
 select coalesce(jsonb_agg(x),'[]') into items from (
 select jsonb_build_object('kind','box','id',b.id,'personId',b.person_id,'quantity',b.quantity,'orderId',o.id,'orderTitle',o.data->>'title','workId',w.id,'description',w.data->>'description','jobId',j.id,'jobName',j.data->>'name') x
 from public.boxes b join public.sub_jobs j on j.id=b.sub_job_id join public.work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id
 where b.person_id=p_person and b.completed_at is null and manufacturing_private.can_read_order(o.id) and (r<>'coach' or w.coach_id=(select person_id from public.staff_profiles where id=auth.uid()))
 union all
 select jsonb_build_object('kind','dumping','id',a.id,'personId',a.person_id,'quantity',a.batch_quantity,'orderId',o.id,'orderTitle',o.data->>'title','workId',w.id,'description',w.data->>'description','jobId',j.id,'jobName',j.data->>'name')
 from public.dumping_assignments a join public.sub_jobs j on j.id=a.sub_job_id join public.work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id
 where a.person_id=p_person and a.active and j.completed<j.quantity and o.stage=1 and manufacturing_private.can_read_order(o.id) and (r<>'coach' or w.coach_id=(select person_id from public.staff_profiles where id=auth.uid()))
 ) q;
 return jsonb_build_object('busy',occupied,'items',items);
end$$;
create function public.app_person_current_work(p_person text) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.person_current_work(p_person);$$;
revoke all on function manufacturing_private.person_current_work(text),public.app_person_current_work(text) from public,anon;
grant execute on function manufacturing_private.person_current_work(text),public.app_person_current_work(text) to authenticated;
commit;
