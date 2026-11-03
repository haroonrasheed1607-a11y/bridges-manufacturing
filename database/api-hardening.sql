create or replace function manufacturing_private.save_order(p_order jsonb,p_revision bigint,p_message text) returns jsonb language plpgsql security definer set search_path='' as $$
declare old public.orders;cid text;v_id text:=p_order->>'id';w jsonb;j jsonb;b jsonb;q jsonb;expected_stage integer;begin
 perform manufacturing_private.require_manager();
 if jsonb_typeof(p_order)<>'object' or v_id is null or length(trim(coalesce(p_order->>'title','')))=0 then raise exception 'Order title and reference are required';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_id,0));select * into old from public.orders where id=v_id for update;
 if old.id is not null and old.revision<>p_revision then raise exception 'This order changed on another device. Refresh and retry.' using errcode='40001';end if;
 if old.id is null and p_revision<>0 then raise exception 'Order no longer exists';end if;
 expected_stage:=(p_order->>'stage')::integer;
 if old.id is null and (expected_stage<>0 or jsonb_array_length(coalesce(p_order->'workOrders','[]'))<>0) then raise exception 'New orders must start without work orders';end if;
 if old.id is not null and (expected_stage<old.stage or expected_stage>old.stage+1) then raise exception 'Orders must move one stage at a time';end if;
 if coalesce((p_order->>'quantity')::integer,0)<1 or coalesce((p_order->>'perPack')::integer,0)<1 then raise exception 'Order quantity and pieces per pack must be positive';end if;
 if p_order->>'workOrderApprovedAt' is not null and (select coalesce(sum((value->>'quantity')::integer),0) from jsonb_array_elements(p_order->'workOrders'))<>(p_order->>'quantity')::integer then raise exception 'Work-order quantities must match the order before approval';end if;
 if old.id is not null and expected_stage>old.stage then
  if old.stage=0 and (old.data->>'assignmentConfirmedAt' is null or exists(select 1 from public.work_orders where order_id=v_id and coach_id is null) or not exists(select 1 from public.work_orders where order_id=v_id)) then raise exception 'Confirm Job Coach assignments first';end if;
  if old.stage=1 and exists(select 1 from public.sub_jobs j join public.work_orders w on w.id=j.work_order_id where w.order_id=v_id and j.completed<>j.quantity) then raise exception 'Complete every sub-job first';end if;
  if old.stage=2 and exists(select 1 from public.work_orders w where w.order_id=v_id and (select (q.data->>'failed')::integer from public.quality_checks q where q.work_order_id=w.id order by (q.data->>'at')::timestamptz desc,q.id desc limit 1) is distinct from 0) then raise exception 'Passing quality checks required';end if;
  if old.stage=3 and exists(select 1 from public.work_orders w where w.order_id=v_id and (select (q.data->>'correct')::boolean from public.packing_checks q where q.work_order_id=w.id order by (q.data->>'at')::timestamptz desc,q.id desc limit 1) is distinct from true) then raise exception 'Confirm packing checks first';end if;
  if old.stage=4 and old.data#>>'{warehouse,receivedAt}' is null then raise exception 'Warehouse receipt required';end if;
  if old.stage=5 and (old.data#>>'{delivery,dispatchedAt}' is null or old.data#>>'{delivery,signature}' is null) then raise exception 'Dispatch and customer signature required';end if;
 end if;
 select id into cid from public.customers where lower(trim(name))=lower(trim(p_order->>'customer'));
 if cid is null then cid:='CUS-'||gen_random_uuid()::text;insert into public.customers(id,name) values(cid,trim(p_order->>'customer'));end if;
 insert into public.orders(id,customer_id,stage,data) values(v_id,cid,expected_stage,p_order-'workOrders'-'history'-'_revision'-'id'-'stage'-'customer')
 on conflict(id) do update set customer_id=excluded.customer_id,stage=excluded.stage,data=excluded.data,revision=orders.revision+1,updated_at=now();
 for w in select value from jsonb_array_elements(coalesce(p_order->'workOrders','[]')) loop
  if exists(select 1 from public.work_orders where id=w->>'id' and order_id<>v_id) then raise exception 'Work order belongs to another order';end if;
  if coalesce(w->>'type','') not in ('Assembly','Packing','Packaging') or coalesce((w->>'seconds')::numeric,0)<=0 then raise exception 'Invalid job type or time per piece';end if;
  if coalesce((w->>'packSeconds')::numeric,0)<0 or coalesce((w->>'hoursPerDay')::numeric,6)<=0 then raise exception 'Invalid packing time or working day';end if;
  if (select coalesce(sum((value->>'quantity')::integer),0) from jsonb_array_elements(w->'jobs'))<>(w->>'quantity')::integer then raise exception 'Sub-job pieces must match work-order quantity';end if;
  if nullif(w->>'coachId','') is not null and not exists(select 1 from public.people where id=w->>'coachId' and kind='coach') then raise exception 'Select a valid Job Coach';end if;
  insert into public.work_orders(id,order_id,coach_id,quantity,pieces_per_pack,data) values(w->>'id',v_id,nullif(w->>'coachId',''),(w->>'quantity')::integer,(w->>'perPack')::integer,w-'jobs'-'boxes'-'audits'-'packing')
  on conflict(id) do update set coach_id=excluded.coach_id,quantity=excluded.quantity,pieces_per_pack=excluded.pieces_per_pack,data=excluded.data;
  for j in select value from jsonb_array_elements(w->'jobs') loop
   if exists(select 1 from public.sub_jobs where id=j->>'id' and work_order_id<>w->>'id') then raise exception 'Sub-job belongs to another work order';end if;
   insert into public.sub_jobs(id,work_order_id,quantity,completed,data) values(j->>'id',w->>'id',(j->>'quantity')::integer,coalesce((j->>'completed')::integer,0),j)
   on conflict(id) do update set quantity=excluded.quantity,completed=excluded.completed,data=excluded.data;
  end loop;
  -- Box creation/completion has its own locked API. A stale generic save cannot alter boxes.
  if coalesce(w->'boxes','[]')<>coalesce((select jsonb_agg(x order by x->>'id') from jsonb_array_elements(coalesce(manufacturing_private.read_order(v_id)->'workOrders','[]')) f cross join lateral jsonb_array_elements(coalesce(f->'boxes','[]')) x where f->>'id'=w->>'id'),'[]') then
   -- compare only IDs here: scanner quantities remain authoritative in boxes.
   if exists(select 1 from jsonb_array_elements(coalesce(w->'boxes','[]')) x where not exists(select 1 from public.boxes b where b.id=x->>'id')) then raise exception 'Create boxes through the box assignment API';end if;
  end if;
  for q in select value from jsonb_array_elements(coalesce(w->'audits','[]')) loop
   if (q->>'mode') not in ('Random Audit','100% Check') or (q->>'inspected')::integer<1 or (q->>'inspected')::integer>(w->>'quantity')::integer or (q->>'failed')::integer<0 or (q->>'failed')::integer>(q->>'inspected')::integer or ((q->>'mode')='100% Check' and (q->>'inspected')::integer<>(w->>'quantity')::integer) then raise exception 'Invalid quality-check quantities';end if;
   insert into public.quality_checks(id,work_order_id,data) values(q->>'id',w->>'id',q) on conflict(id) do nothing;
  end loop;
  for q in select value from jsonb_array_elements(coalesce(w->'packing','[]')) loop insert into public.packing_checks(id,work_order_id,data) values(q->>'id',w->>'id',q) on conflict(id) do nothing;end loop;
 end loop;
 if exists(select 1 from public.work_orders where order_id=v_id and id not in(select value->>'id' from jsonb_array_elements(coalesce(p_order->'workOrders','[]')))) then raise exception 'Removing saved work orders is not supported';end if;
 if old.id is not null and old.stage>0 and exists(select 1 from public.sub_jobs j join public.work_orders w on w.id=j.work_order_id where w.order_id=v_id and j.completed<coalesce((select sum(completed_pieces) from public.boxes where sub_job_id=j.id),0)) then raise exception 'Completed pieces cannot be less than scanned boxes';end if;
 insert into public.order_events(order_id,actor_id,message) values(v_id,auth.uid(),left(coalesce(p_message,'Order updated'),500));
 return manufacturing_private.workspace();end$$;

drop policy manufacturing_files_insert on storage.objects;
create policy manufacturing_files_insert on storage.objects for insert to authenticated with check(bucket_id='manufacturing-files' and (storage.foldername(name))[1]='orders' and (select manufacturing_private.actor_role()) in ('admin','manager'));
