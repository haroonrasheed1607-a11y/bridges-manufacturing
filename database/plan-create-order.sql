begin;
-- Preserve the item's saved production setup, using its latest work order once
-- when introducing defaults. Brand-new items keep the standard 25-piece pack.
alter table public.customer_items add column production_defaults jsonb not null default '{}'
 check(jsonb_typeof(production_defaults)='object');
update public.customer_items i set production_defaults=(
 select jsonb_build_object('perPack',w.pieces_per_pack,'type',coalesce(w.data->>'type','Assembly'),
   'description',coalesce(w.data->>'description',i.name),'instructions',coalesce(w.data->>'instructions',''))
 from public.orders o join public.work_orders w on w.order_id=o.id
 where o.customer_id=i.customer_id and o.data->>'catalogItemId'=i.id::text
 order by w.created_at desc,w.id limit 1)
where exists(select 1 from public.orders o join public.work_orders w on w.order_id=o.id
 where o.customer_id=i.customer_id and o.data->>'catalogItemId'=i.id::text);

create table public.work_order_coaches(
 work_order_id text not null references public.work_orders(id) on delete cascade,
 person_id text not null references public.people(id),
 primary key(work_order_id,person_id)
);
create index work_order_coaches_person_idx on public.work_order_coaches(person_id);
alter table public.work_order_coaches enable row level security;
revoke all on public.work_order_coaches from public,anon,authenticated;

create function manufacturing_private.coach_can_manage_work(p_work text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff_profiles s join public.people p on p.id=s.person_id
 join public.work_orders w on w.id=p_work
 where s.id=auth.uid() and s.active and s.role='coach' and p.kind='coach'
 and p.data->>'active' is distinct from 'false'
 and (w.coach_id=p.id or exists(select 1 from public.work_order_coaches c where c.work_order_id=w.id and c.person_id=p.id)));
$$;
revoke all on function manufacturing_private.coach_can_manage_work(text) from public,anon;
grant execute on function manufacturing_private.coach_can_manage_work(text) to authenticated;

create or replace function manufacturing_private.can_read_order(p_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (manufacturing_private.actor_role() in ('admin','manager') or
 (manufacturing_private.actor_role() in ('station','box_setup','box_scanner') and exists(select 1 from public.orders where id=p_id and stage=1)) or
 (manufacturing_private.actor_role()='coach' and exists(select 1 from public.work_orders w where w.order_id=p_id and manufacturing_private.coach_can_manage_work(w.id))));
$$;

-- Apply shared coach access consistently to production, plans and reports while
-- keeping each endpoint's existing role checks and legacy single-coach access.
do $$
declare name regprocedure; definition text; original text;
begin
 foreach name in array array[
 'manufacturing_private.read_order(text)'::regprocedure,
 'manufacturing_private.create_box(text,text,jsonb)'::regprocedure,
 'manufacturing_private.complete_box(text,integer)'::regprocedure,
 'manufacturing_private.dumping_access(text,boolean)'::regprocedure,
 'manufacturing_private.dumping_list()'::regprocedure,
 'manufacturing_private.person_current_work(text)'::regprocedure,
 'manufacturing_private.scan_assign_approvals(date)'::regprocedure,
 'manufacturing_private.day_plan_group(date,text,text[],text[],uuid,boolean)'::regprocedure,
 'manufacturing_private.shop_floor_dashboard(date)'::regprocedure
 ] loop
  original:=pg_get_functiondef(name);
  definition:=replace(original,'w.coach_id is distinct from (select person_id from public.staff_profiles where id=auth.uid())','not manufacturing_private.coach_can_manage_work(w.id)');
  definition:=replace(definition,'w.coach_id=(select person_id from public.staff_profiles where id=auth.uid())','manufacturing_private.coach_can_manage_work(w.id)');
  definition:=replace(definition,'wo.coach_id=(select person_id from public.staff_profiles where id=auth.uid())','manufacturing_private.coach_can_manage_work(wo.id)');
  if definition=original then raise exception 'Unexpected coach access definition: %',name;end if;
  execute definition;
 end loop;
 name:='manufacturing_private.scanner_daily_work(date)'::regprocedure;
 original:=pg_get_functiondef(name);
 definition:=replace(original,'exists(select 1 from public.work_orders w join public.staff_profiles s on s.person_id=w.coach_id where w.order_id=e.order_id and s.id=auth.uid())',
  'exists(select 1 from public.work_orders w where w.order_id=e.order_id and manufacturing_private.coach_can_manage_work(w.id))');
 if definition=original then raise exception 'Unexpected scanner report coach access';end if;
 execute definition;
 original:=pg_get_functiondef('manufacturing_private.workspace()'::regprocedure);
 definition:=replace(original,'''rate'',i.rate)','''rate'',i.rate,''productionDefaults'',i.production_defaults)');
 if definition=original then raise exception 'Unexpected catalog projection';end if;
 execute definition;
end $$;

create table public.plan_order_requests(
 request_id uuid primary key,
 actor_id uuid not null references auth.users(id),
 customer_id text not null references public.customers(id),
 item_id uuid not null references public.customer_items(id),
 quantity integer not null check(quantity between 1 and 1000000),
 order_id text not null references public.orders(id),
 result jsonb not null,
 created_at timestamptz not null default now()
);
create index plan_order_requests_actor_idx on public.plan_order_requests(actor_id);
create index plan_order_requests_customer_idx on public.plan_order_requests(customer_id);
create index plan_order_requests_item_idx on public.plan_order_requests(item_id);
create index plan_order_requests_order_idx on public.plan_order_requests(order_id);
alter table public.plan_order_requests enable row level security;
revoke all on public.plan_order_requests from public,anon,authenticated;

create function manufacturing_private.plan_create_order(p_customer text,p_item uuid,p_quantity integer,p_date date,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 item public.customer_items; receipt public.plan_order_requests;
 today date:=(clock_timestamp() at time zone 'America/Chicago')::date;
 oid text; wid text; jid text; approval uuid; coaches text[]; per_pack integer; scan_qty integer;
 job_kind text; work_data jsonb; result jsonb; now_at timestamptz:=clock_timestamp();
begin
 perform manufacturing_private.require_manager();
 if p_request is null or p_customer is null or p_item is null or p_quantity is null or p_quantity not between 1 and 1000000 then
  raise exception 'Select a client, an item and 1–1,000,000 pieces';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('plan-create-order:'||p_request::text,0));
 select * into receipt from public.plan_order_requests where request_id=p_request;
 if receipt.request_id is not null then
  if receipt.actor_id is distinct from auth.uid() or receipt.customer_id is distinct from p_customer
   or receipt.item_id is distinct from p_item or receipt.quantity is distinct from p_quantity then
   raise exception 'This plan request reference has already been used';
  end if;
  return receipt.result||jsonb_build_object('duplicate',true);
 end if;
 if p_date is distinct from today then raise exception 'The day changed. Refresh before planning work.' using errcode='40001';end if;
 select * into item from public.customer_items where id=p_item and customer_id=p_customer for share;
 if item.id is null then raise exception 'Select an item registered for this client';end if;
 select coalesce(array_agg(id order by id),'{}'::text[]) into coaches from public.people
 where kind='coach' and data->>'active' is distinct from 'false';
 if cardinality(coaches)=0 then raise exception 'Register an active Job Coach before planning work';end if;
 per_pack:=coalesce((item.production_defaults->>'perPack')::integer,25);
 if per_pack not between 1 and 1000000 then raise exception 'The item needs a valid pieces-per-pack setting';end if;
 scan_qty:=least(per_pack,p_quantity);
 job_kind:=coalesce(item.production_defaults->>'type','Assembly');
 if job_kind not in ('Assembly','Packing','Packaging') then raise exception 'The item needs a valid job type';end if;
 oid:='ORD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 wid:='WO-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 jid:='SJ-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 work_data:=jsonb_build_object('type',job_kind,'description',coalesce(nullif(item.production_defaults->>'description',''),item.name),
  'instructions',coalesce(item.production_defaults->>'instructions',''),'seconds',30,'packSeconds',0,
  'packageSeconds',per_pack*30,'timingVersion',2,'hoursPerDay',6,'startDate',today,'expected',today,'required',today,
  'people',greatest(1,ceil(p_quantity::numeric*30/21600)),'packsPerSubJob',ceil(p_quantity::numeric/per_pack),
  'totalSeconds',p_quantity*30,'coachName','All active Job Coaches','coachIds',to_jsonb(coaches),'sharedCoaches',true,'parts','[]'::jsonb);
 insert into public.orders(id,customer_id,stage,data) values(oid,p_customer,1,jsonb_build_object(
  'title',item.name,'catalogItemId',item.id,'catalogCode',item.code,'catalogRate',item.rate,
  'quantity',p_quantity,'perPack',per_pack,'packCount',ceil(p_quantity::numeric/per_pack),'frequency','one-time','repeatEveryDays',null,
  'required',today,'expected',today,'createdAt',now_at,'workOrderApprovedAt',now_at,'assignmentConfirmedAt',now_at,
  'productionStartedAt',now_at,'quickPlanned',true,'pictures','[]'::jsonb));
 insert into public.work_orders(id,order_id,coach_id,quantity,pieces_per_pack,scan_cooldown_seconds,scan_pieces,data)
 values(wid,oid,coaches[1],p_quantity,per_pack,120,scan_qty,work_data);
 insert into public.work_order_coaches(work_order_id,person_id) select wid,unnest(coaches);
 insert into public.sub_jobs(id,work_order_id,quantity,data) values(jid,wid,p_quantity,
  jsonb_build_object('name','Sub-job 1','packs',ceil(p_quantity::numeric/per_pack)));
 insert into public.scan_assign_approvals(sub_job_id,work_date,pieces_per_scan,approved_by)
 values(jid,today,scan_qty,auth.uid()) returning id into approval;
 insert into public.order_events(order_id,actor_id,message) values(oid,auth.uid(),
  format('Plan Work: order and work order approved, assigned to %s active Job Coaches, one sub-job created and Scan & Assign approved for %s. Delivery deadline: %s.',cardinality(coaches),today,today));
 result:=jsonb_build_object('orderId',oid,'workId',wid,'jobId',jid,'approvalId',approval,'title',item.name,'code',item.code,
  'quantity',p_quantity,'piecesPerScan',scan_qty,'date',today,'required',today,'coachCount',cardinality(coaches),'duplicate',false);
 insert into public.plan_order_requests(request_id,actor_id,customer_id,item_id,quantity,order_id,result)
 values(p_request,auth.uid(),p_customer,p_item,p_quantity,oid,result);
 return result;
end $$;
create function public.app_plan_create_order(p_customer text,p_item uuid,p_quantity integer,p_date date,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.plan_create_order(p_customer,p_item,p_quantity,p_date,p_request);
$$;
revoke all on function manufacturing_private.plan_create_order(text,uuid,integer,date,uuid),
 public.app_plan_create_order(text,uuid,integer,date,uuid) from public,anon;
grant execute on function manufacturing_private.plan_create_order(text,uuid,integer,date,uuid),
 public.app_plan_create_order(text,uuid,integer,date,uuid) to authenticated;
commit;
