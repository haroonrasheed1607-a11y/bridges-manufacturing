-- Separate shop-floor setup and scanning permissions. Apply after schema.sql and api-hardening.sql.
begin;
alter table public.staff_profiles drop constraint staff_profiles_role_check;
alter table public.staff_profiles add constraint staff_profiles_role_check check(role in ('admin','manager','coach','station','box_setup','box_scanner'));
CREATE OR REPLACE FUNCTION manufacturing_private.create_box(p_order_id text, p_work_id text, p_box jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare o public.orders;w public.work_orders;j public.sub_jobs;pending integer;qty integer:=(p_box->>'quantity')::integer;hours numeric;r text:=manufacturing_private.actor_role();begin
 if auth.uid() is null or r is null then raise exception 'Staff access required' using errcode='42501';end if;
 if r not in ('admin','manager','coach','station','box_setup') then raise exception 'Box setup access required' using errcode='42501';end if;
 select * into o from public.orders where id=p_order_id for update;select * into w from public.work_orders where id=p_work_id and order_id=o.id;select * into j from public.sub_jobs where id=p_box->>'jobId' and work_order_id=w.id;
 if o.stage<>1 or w.id is null or j.id is null then raise exception 'Choose an order in production and a valid sub-job';end if;
 if r='coach' and w.coach_id is distinct from (select person_id from public.staff_profiles where id=auth.uid()) then raise exception 'Work order is not assigned to you' using errcode='42501';end if;
 if not exists(select 1 from public.people where id=p_box->>'personId' and kind='individual') then raise exception 'Select a valid individual';end if;
 if extract(isodow from (p_box->>'date')::date)>5 then raise exception 'Choose a working day';end if;
 select coalesce(sum(quantity),0) into pending from public.boxes where sub_job_id=j.id and completed_at is null;
 if qty<1 or qty+j.completed+pending>j.quantity then raise exception 'Box exceeds unallocated sub-job quantity';end if;
 hours:=(qty*coalesce((w.data->>'seconds')::numeric,30)+ceil(qty::numeric/w.pieces_per_pack)*coalesce((w.data->>'packSeconds')::numeric,0))/3600;
 insert into public.boxes(id,sub_job_id,person_id,quantity,data) values(p_box->>'id',j.id,p_box->>'personId',qty,p_box||jsonb_build_object('createdAt',now(),'coachId',w.coach_id));
 insert into public.bookings(id,person_id,order_id,work_order_id,starts_on,ends_on,hours,data) values(p_box->>'id',p_box->>'personId',o.id,w.id,(p_box->>'date')::date,(p_box->>'date')::date,hours,jsonb_build_object('notes','Box assignment'));
 update public.orders set revision=revision+1,updated_at=now() where id=o.id;
 insert into public.order_events(order_id,actor_id,message) values(o.id,auth.uid(),'Box '||(p_box->>'id')||' created and assigned.');return manufacturing_private.workspace();end$function$;

CREATE OR REPLACE FUNCTION manufacturing_private.read_order(p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$declare result jsonb;r text:=manufacturing_private.actor_role();begin
 if not manufacturing_private.can_read_order(p_id) then raise exception 'Order access denied' using errcode='42501';end if;
 select o.data||jsonb_build_object('id',o.id,'stage',o.stage,'_revision',o.revision,'customer',case when r in ('station','box_setup','box_scanner') then 'Production' else c.name end,
 'workOrders',coalesce((select jsonb_agg(w.data||jsonb_build_object('id',w.id,'coachId',w.coach_id,'quantity',w.quantity,'perPack',w.pieces_per_pack,
 'jobs',coalesce((select jsonb_agg(j.data||jsonb_build_object('id',j.id,'quantity',j.quantity,'completed',j.completed) order by j.id) from public.sub_jobs j where j.work_order_id=w.id),'[]'),
 'boxes',coalesce((select jsonb_agg(b.data||jsonb_build_object('id',b.id,'jobId',b.sub_job_id,'personId',b.person_id,'quantity',b.quantity)||case when b.completed_at is not null then jsonb_build_object('completedAt',b.completed_at,'completedPieces',b.completed_pieces,'status','completed') else '{}'::jsonb end order by b.id) from public.boxes b join public.sub_jobs j on j.id=b.sub_job_id where j.work_order_id=w.id),'[]'),
 'audits',case when r in ('admin','manager') then coalesce((select jsonb_agg(q.data order by (q.data->>'at')::timestamptz,q.id) from public.quality_checks q where q.work_order_id=w.id),'[]') else '[]'::jsonb end,
 'packing',case when r in ('admin','manager') then coalesce((select jsonb_agg(q.data order by (q.data->>'at')::timestamptz,q.id) from public.packing_checks q where q.work_order_id=w.id),'[]') else '[]'::jsonb end) order by w.id) from public.work_orders w where w.order_id=o.id and (r<>'coach' or w.coach_id=(select person_id from public.staff_profiles where id=auth.uid()))),'[]'),
 'history',case when r in ('admin','manager') then coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'message',e.message,'at',e.occurred_at) order by e.occurred_at,e.id) from public.order_events e where e.order_id=o.id),'[]') else '[]'::jsonb end) into result from public.orders o join public.customers c on c.id=o.customer_id where o.id=p_id;
 if r not in ('admin','manager') then result:=result-'delivery'-'warehouse'-'pictures'-'customer_snapshot';end if;
 return result;
end$function$;

CREATE OR REPLACE FUNCTION manufacturing_private.complete_box(p_box_id text, p_pieces integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare b public.boxes;j public.sub_jobs;w public.work_orders;o public.orders;r text:=manufacturing_private.actor_role();begin
 if auth.uid() is null or r is null then raise exception 'Staff access required' using errcode='42501';end if;
 if r not in ('admin','manager','coach','station','box_scanner') then raise exception 'Box scanning access required' using errcode='42501';end if;
 select wo.* into w from public.work_orders wo join public.sub_jobs sj on sj.work_order_id=wo.id join public.boxes bx on bx.sub_job_id=sj.id where bx.id=p_box_id;
 select * into o from public.orders where id=w.order_id for update;select * into b from public.boxes where id=p_box_id for update;select * into j from public.sub_jobs where id=b.sub_job_id for update;
 if b.id is null then raise exception 'Box code not found';end if;
 if o.stage<>1 then raise exception 'Order is not in production';end if;
 if r='coach' and w.coach_id is distinct from (select person_id from public.staff_profiles where id=auth.uid()) then raise exception 'Work order is not assigned to you' using errcode='42501';end if;
 if b.completed_at is not null then raise exception 'This box is already completed';end if;
 if p_pieces<0 or p_pieces>b.quantity or p_pieces+j.completed>j.quantity then raise exception 'Invalid completed-piece quantity';end if;
 update public.boxes set completed_pieces=p_pieces,completed_at=now() where id=b.id;
 update public.sub_jobs set completed=completed+p_pieces where id=j.id;
 update public.bookings set status='completed' where id=b.id;
 insert into public.production_records(box_id,completed_pieces,actor_id) values(b.id,p_pieces,auth.uid());
 update public.orders set revision=revision+1,updated_at=now() where id=o.id;
 insert into public.order_events(order_id,actor_id,message) values(o.id,auth.uid(),'Box '||b.id||' completed: '||p_pieces||' pieces.');return manufacturing_private.workspace();end$function$;

CREATE OR REPLACE FUNCTION manufacturing_private.can_read_order(p_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and (manufacturing_private.actor_role() in ('admin','manager') or
 (manufacturing_private.actor_role() in ('station','box_setup','box_scanner') and exists(select 1 from public.orders where id=p_id and stage=1)) or
 (manufacturing_private.actor_role()='coach' and exists(select 1 from public.work_orders w join public.staff_profiles p on p.person_id=w.coach_id where w.order_id=p_id and p.id=auth.uid() and p.active)));
$function$;
commit;
