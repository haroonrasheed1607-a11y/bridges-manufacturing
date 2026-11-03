-- Bridges Manufacturing: relational foundation and compatibility APIs.
-- Display references remain text so existing preview exports can be imported intact.
begin;
create schema if not exists manufacturing_private;
revoke all on schema manufacturing_private from public,anon;
grant usage on schema manufacturing_private to authenticated;
create table public.staff_profiles(id uuid primary key references auth.users(id) on delete cascade,display_name text not null default '',role text not null check(role in ('admin','manager','coach','station')),person_id text,active boolean not null default true,created_at timestamptz not null default now());
create index staff_profiles_person_idx on public.staff_profiles(person_id);
create table public.customers(id text primary key,name text not null check(length(trim(name))>0),details jsonb not null default '{}',is_demo boolean not null default false,created_at timestamptz not null default now());
create unique index customers_name_unique on public.customers(lower(trim(name)));
create table public.people(id text primary key,name text not null check(length(trim(name))>0),kind text not null check(kind in ('coach','individual')),hours_per_day numeric not null default 6 check(hours_per_day>0 and hours_per_day<=24),data jsonb not null default '{}',is_demo boolean not null default false);
alter table public.staff_profiles add constraint staff_person_fk foreign key(person_id) references public.people(id);
create table public.orders(id text primary key,customer_id text not null references public.customers(id),stage smallint not null default 0 check(stage between 0 and 6),data jsonb not null default '{}',revision bigint not null default 1,is_demo boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index orders_customer_idx on public.orders(customer_id);
create index orders_stage_idx on public.orders(stage);
create table public.work_orders(id text primary key,order_id text not null references public.orders(id) on delete cascade,coach_id text references public.people(id),quantity integer not null check(quantity>0),pieces_per_pack integer not null check(pieces_per_pack>0),data jsonb not null default '{}');
create index work_orders_order_idx on public.work_orders(order_id);
create index work_orders_coach_idx on public.work_orders(coach_id);
create table public.sub_jobs(id text primary key,work_order_id text not null references public.work_orders(id) on delete cascade,quantity integer not null check(quantity>0),completed integer not null default 0 check(completed>=0 and completed<=quantity),data jsonb not null default '{}');
create index sub_jobs_work_idx on public.sub_jobs(work_order_id);
create table public.boxes(id text primary key,sub_job_id text not null references public.sub_jobs(id),person_id text not null references public.people(id),quantity integer not null check(quantity>0),completed_pieces integer check(completed_pieces>=0 and completed_pieces<=quantity),completed_at timestamptz,data jsonb not null default '{}',created_at timestamptz not null default now());
create index boxes_job_idx on public.boxes(sub_job_id);
create index boxes_person_idx on public.boxes(person_id);
create table public.bookings(id text primary key,person_id text not null references public.people(id),order_id text not null references public.orders(id),work_order_id text not null references public.work_orders(id),starts_on date not null,ends_on date not null,hours numeric not null check(hours>0),status text not null default 'booked' check(status in ('booked','released','completed')),data jsonb not null default '{}',check(ends_on>=starts_on));
create index bookings_person_dates_idx on public.bookings(person_id,starts_on,ends_on);
create index bookings_order_idx on public.bookings(order_id);
create index bookings_work_idx on public.bookings(work_order_id);
create table public.quality_checks(id text primary key,work_order_id text not null references public.work_orders(id),data jsonb not null);
create index quality_work_idx on public.quality_checks(work_order_id);
create table public.packing_checks(id text primary key,work_order_id text not null references public.work_orders(id),data jsonb not null);
create index packing_work_idx on public.packing_checks(work_order_id);
create table public.order_events(id uuid primary key default gen_random_uuid(),order_id text not null references public.orders(id),actor_id uuid references auth.users(id) on delete set null,message text not null,occurred_at timestamptz not null default now());
create index events_order_idx on public.order_events(order_id,occurred_at);
create index events_actor_idx on public.order_events(actor_id);
create table public.production_records(id uuid primary key default gen_random_uuid(),box_id text not null unique references public.boxes(id),completed_pieces integer not null check(completed_pieces>=0),actor_id uuid references auth.users(id) on delete set null,completed_at timestamptz not null default now());
create index production_actor_idx on public.production_records(actor_id);
create table public.calendar_settings(id boolean primary key default true check(id),timezone text not null default 'America/Chicago',working_weekdays integer[] not null default array[1,2,3,4,5],hours_per_day numeric not null default 6 check(hours_per_day>0 and hours_per_day<=24));
insert into public.calendar_settings default values;
create table public.calendar_exceptions(id uuid primary key default gen_random_uuid(),person_id text references public.people(id),date date not null,available_hours numeric not null check(available_hours>=0 and available_hours<=24),reason text);
create index calendar_person_idx on public.calendar_exceptions(person_id,date);
create table public.order_schedules(id uuid primary key default gen_random_uuid(),customer_id text not null references public.customers(id),interval_days integer not null check(interval_days>0),next_due_date date not null,data jsonb not null default '{}',active boolean not null default true);
create index schedules_customer_idx on public.order_schedules(customer_id);
-- Current web forms use whole-order warehouse/delivery objects. Store these
-- within orders.data in phase one; quantity-based partial delivery APIs follow.
-- Child plans, production, quality and packing already have relational tables.

create function manufacturing_private.actor_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.staff_profiles where id=auth.uid() and active and auth.uid() is not null;
$$;
create function manufacturing_private.can_read_order(p_id text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (manufacturing_private.actor_role() in ('admin','manager') or
 (manufacturing_private.actor_role()='station' and exists(select 1 from public.orders where id=p_id and stage=1)) or
 (manufacturing_private.actor_role()='coach' and exists(select 1 from public.work_orders w join public.staff_profiles p on p.person_id=w.coach_id where w.order_id=p_id and p.id=auth.uid() and p.active)));
$$;
create function manufacturing_private.require_manager() returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or manufacturing_private.actor_role() not in ('admin','manager') or manufacturing_private.actor_role() is null then raise exception 'Manager access required' using errcode='42501';end if;
end$$;
create function manufacturing_private.read_order(p_id text) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;r text:=manufacturing_private.actor_role();begin
 if not manufacturing_private.can_read_order(p_id) then raise exception 'Order access denied' using errcode='42501';end if;
 select o.data||jsonb_build_object('id',o.id,'stage',o.stage,'_revision',o.revision,'customer',case when r='station' then 'Production' else c.name end,
 'workOrders',coalesce((select jsonb_agg(w.data||jsonb_build_object('id',w.id,'coachId',w.coach_id,'quantity',w.quantity,'perPack',w.pieces_per_pack,
 'jobs',coalesce((select jsonb_agg(j.data||jsonb_build_object('id',j.id,'quantity',j.quantity,'completed',j.completed) order by j.id) from public.sub_jobs j where j.work_order_id=w.id),'[]'),
 'boxes',coalesce((select jsonb_agg(b.data||jsonb_build_object('id',b.id,'jobId',b.sub_job_id,'personId',b.person_id,'quantity',b.quantity)||case when b.completed_at is not null then jsonb_build_object('completedAt',b.completed_at,'completedPieces',b.completed_pieces,'status','completed') else '{}'::jsonb end order by b.id) from public.boxes b join public.sub_jobs j on j.id=b.sub_job_id where j.work_order_id=w.id),'[]'),
 'audits',case when r in ('admin','manager') then coalesce((select jsonb_agg(q.data order by (q.data->>'at')::timestamptz,q.id) from public.quality_checks q where q.work_order_id=w.id),'[]') else '[]'::jsonb end,
 'packing',case when r in ('admin','manager') then coalesce((select jsonb_agg(q.data order by (q.data->>'at')::timestamptz,q.id) from public.packing_checks q where q.work_order_id=w.id),'[]') else '[]'::jsonb end) order by w.id) from public.work_orders w where w.order_id=o.id and (r<>'coach' or w.coach_id=(select person_id from public.staff_profiles where id=auth.uid()))),'[]'),
 'history',case when r in ('admin','manager') then coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'message',e.message,'at',e.occurred_at) order by e.occurred_at,e.id) from public.order_events e where e.order_id=o.id),'[]') else '[]'::jsonb end) into result from public.orders o join public.customers c on c.id=o.customer_id where o.id=p_id;
 if r not in ('admin','manager') then result:=result-'delivery'-'warehouse'-'pictures'-'customer_snapshot';end if;
 return result;
end$$;
create function manufacturing_private.workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$declare r text:=manufacturing_private.actor_role();begin
 if auth.uid() is null or r is null then raise exception 'Your account is awaiting staff approval' using errcode='42501';end if;
 return jsonb_build_object('orders',coalesce((select jsonb_agg(manufacturing_private.read_order(o.id) order by o.created_at desc,o.id) from public.orders o where manufacturing_private.can_read_order(o.id)),'[]'),
 'customers',case when r in ('admin','manager') then coalesce((select jsonb_agg(name order by name) from public.customers),'[]') else '[]'::jsonb end,
 'workforce',jsonb_build_object('people',coalesce((select jsonb_agg(p.data||jsonb_build_object('id',p.id,'name',p.name,'kind',p.kind,'hoursPerDay',p.hours_per_day) order by p.name) from public.people p),'[]'),
 'bookings',coalesce((select jsonb_agg(b.data||jsonb_build_object('id',b.id,'personId',b.person_id,'orderId',b.order_id,'workId',b.work_order_id,'start',b.starts_on,'end',b.ends_on,'hours',b.hours,'status',b.status)) from public.bookings b where manufacturing_private.can_read_order(b.order_id)),'[]')));
end$$;
create function manufacturing_private.save_customer(p_name text) returns jsonb language plpgsql security definer set search_path='' as $$declare n text:=trim(regexp_replace(p_name,'\s+',' ','g'));begin
 perform manufacturing_private.require_manager();if length(n)=0 or length(n)>200 then raise exception 'Enter a customer name (up to 200 characters)';end if;
 insert into public.customers(id,name) values('CUS-'||gen_random_uuid()::text,n) on conflict(lower(trim(name))) do nothing;
 return manufacturing_private.workspace();end$$;
create function manufacturing_private.save_person(p_person jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform manufacturing_private.require_manager();
 insert into public.people(id,name,kind,hours_per_day,data) values(p_person->>'id',trim(p_person->>'name'),p_person->>'kind',(p_person->>'hoursPerDay')::numeric,p_person)
 on conflict(id) do update set name=excluded.name,kind=excluded.kind,hours_per_day=excluded.hours_per_day,data=excluded.data;
 return manufacturing_private.workspace();end$$;
create function manufacturing_private.save_booking(p_booking jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare w public.work_orders;o public.orders;begin
 perform manufacturing_private.require_manager();select * into w from public.work_orders where id=p_booking->>'workId';select * into o from public.orders where id=w.order_id;
 if w.id is null or o.stage>1 or o.id<>p_booking->>'orderId' then raise exception 'Select an active work order';end if;
 if not exists(select 1 from generate_series((p_booking->>'start')::date,(p_booking->>'end')::date,'1 day') d where extract(isodow from d)<6) then raise exception 'Booking must contain a working day';end if;
 insert into public.bookings(id,person_id,order_id,work_order_id,starts_on,ends_on,hours,status,data) values(p_booking->>'id',p_booking->>'personId',o.id,w.id,(p_booking->>'start')::date,(p_booking->>'end')::date,(p_booking->>'hours')::numeric,'booked',p_booking)
 on conflict(id) do update set person_id=excluded.person_id,starts_on=excluded.starts_on,ends_on=excluded.ends_on,hours=excluded.hours,status='booked',data=excluded.data where bookings.order_id=excluded.order_id and bookings.work_order_id=excluded.work_order_id;
 return manufacturing_private.workspace();end$$;
create function manufacturing_private.release_booking(p_id text) returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform manufacturing_private.require_manager();update public.bookings set status='released' where id=p_id;return manufacturing_private.workspace();end$$;

create function manufacturing_private.save_order(p_order jsonb,p_revision bigint,p_message text) returns jsonb language plpgsql security definer set search_path='' as $$
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

create function manufacturing_private.create_box(p_order_id text,p_work_id text,p_box jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare o public.orders;w public.work_orders;j public.sub_jobs;pending integer;qty integer:=(p_box->>'quantity')::integer;hours numeric;r text:=manufacturing_private.actor_role();begin
 if auth.uid() is null or r is null then raise exception 'Staff access required' using errcode='42501';end if;
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
 insert into public.order_events(order_id,actor_id,message) values(o.id,auth.uid(),'Box '||(p_box->>'id')||' created and assigned.');return manufacturing_private.workspace();end$$;
create function manufacturing_private.complete_box(p_box_id text,p_pieces integer) returns jsonb language plpgsql security definer set search_path='' as $$declare b public.boxes;j public.sub_jobs;w public.work_orders;o public.orders;r text:=manufacturing_private.actor_role();begin
 if auth.uid() is null or r is null then raise exception 'Staff access required' using errcode='42501';end if;
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
 insert into public.order_events(order_id,actor_id,message) values(o.id,auth.uid(),'Box '||b.id||' completed: '||p_pieces||' pieces.');return manufacturing_private.workspace();end$$;

-- Explicit RLS and no anonymous table access. Mutations go through checked RPCs.
do $$declare t text;begin
 foreach t in array array['staff_profiles','customers','people','orders','work_orders','sub_jobs','boxes','bookings','quality_checks','packing_checks','order_events','production_records','calendar_settings','calendar_exceptions','order_schedules'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 if t='staff_profiles' then execute 'create policy own_profile on public.staff_profiles for select to authenticated using (id=(select auth.uid()))';
 else execute format('create policy managers_read on public.%I for select to authenticated using ((select manufacturing_private.actor_role()) in (''admin'',''manager''))',t);end if;
 end loop;
end$$;
-- No privileged function is in an exposed schema. Public wrappers run as caller.
create function public.app_my_profile() returns jsonb language sql stable security invoker set search_path='' as $$select coalesce((select jsonb_build_object('id',id,'name',display_name,'role',role,'personId',person_id,'active',active) from public.staff_profiles where id=auth.uid()),jsonb_build_object('active',false,'role',null));$$;
create function public.app_get_workspace() returns jsonb language sql stable security invoker set search_path='' as $$select manufacturing_private.workspace();$$;
create function public.app_save_customer(p_name text) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.save_customer(p_name);$$;
create function public.app_save_person(p_person jsonb) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.save_person(p_person);$$;
create function public.app_save_booking(p_booking jsonb) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.save_booking(p_booking);$$;
create function public.app_release_booking(p_id text) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.release_booking(p_id);$$;
create function public.app_save_order(p_order jsonb,p_revision bigint,p_message text) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.save_order(p_order,p_revision,p_message);$$;
create function public.app_create_box(p_order_id text,p_work_id text,p_box jsonb) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.create_box(p_order_id,p_work_id,p_box);$$;
create function public.app_complete_box(p_box_id text,p_pieces integer) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.complete_box(p_box_id,p_pieces);$$;
revoke all on all functions in schema manufacturing_private from public,anon,authenticated;
grant execute on all functions in schema manufacturing_private to authenticated;
do $$declare f record;begin for f in select oid::regprocedure::text sig from pg_proc where pronamespace='public'::regnamespace and proname like 'app\_%' loop execute 'revoke all on function '||f.sig||' from public,anon';execute 'grant execute on function '||f.sig||' to authenticated';end loop;end$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('manufacturing-files','manufacturing-files',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do nothing;
create policy manufacturing_files_read on storage.objects for select to authenticated using(bucket_id='manufacturing-files' and manufacturing_private.can_read_order((storage.foldername(name))[2]));
create policy manufacturing_files_insert on storage.objects for insert to authenticated with check(bucket_id='manufacturing-files' and (storage.foldername(name))[1]='orders' and (select manufacturing_private.actor_role()) in ('admin','manager'));
notify pgrst,'reload schema';
commit;
