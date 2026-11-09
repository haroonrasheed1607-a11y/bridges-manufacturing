begin;

alter table public.dumping_assignments add column if not exists work_date date;
drop index if exists public.dumping_active_person_job_idx;
create unique index if not exists dumping_active_person_job_idx on public.dumping_assignments(person_id,sub_job_id)
 where active and work_date is null;
create unique index if not exists reusable_active_person_day_idx on public.dumping_assignments(person_id,work_date)
 where active and work_date is not null;
create index if not exists reusable_plan_date_idx on public.dumping_assignments(work_date,sub_job_id)
 where active and work_date is not null;

-- Future and expired plans do not occupy the live assignment slot.
do $patch$
declare fn regprocedure; definition text; old_term text:='a.active and j.completed<j.quantity and o.stage=1';
 new_term text:='a.active and (a.work_date is null or a.work_date=(now() at time zone ''America/Chicago'')::date) and j.completed<j.quantity and o.stage=1';
begin
 foreach fn in array array['manufacturing_private.require_person_free(text,text)'::regprocedure,'manufacturing_private.person_current_work(text)'::regprocedure] loop
   definition:=pg_get_functiondef(fn);
   if position(old_term in definition)>0 then
     definition:=replace(definition,old_term,new_term);
     definition:=replace(definition,'''quantity'',a.batch_quantity,''orderId''','''quantity'',a.batch_quantity,''workDate'',a.work_date,''orderId''');
     execute definition;
   elsif position(new_term in definition)=0 then raise exception 'Unexpected current-work function %',fn;end if;
 end loop;
 definition:=pg_get_functiondef('manufacturing_private.dumping_list()'::regprocedure);
 if position('''workDate'',a.work_date' in definition)=0 then
   definition:=replace(definition,'''batchQuantity'',a.batch_quantity','''batchQuantity'',a.batch_quantity,''workDate'',a.work_date');
   execute definition;
 end if;
 definition:=pg_get_functiondef('manufacturing_private.dumping_scan(text,uuid,integer)'::regprocedure);
 if position('This label is planned for' in definition)=0 then
   if position(' if not a.active or o.stage<>1 then' in definition)=0 then raise exception 'Unexpected reusable scan function';end if;
   -- The existing scan holds the order lock. Take the person lock before the assignment row.
   definition:=replace(definition,' select * into a from public.dumping_assignments where id=a.id for update;',
     ' if a.work_date is not null then perform 1 from public.people where id=a.person_id for update; end if;'||chr(10)||
     ' select * into a from public.dumping_assignments where id=a.id for update;');
   definition:=replace(definition,' if not a.active or o.stage<>1 then',
     ' if a.work_date is not null then'||chr(10)||
     '   if a.work_date<>(clock_timestamp() at time zone ''America/Chicago'')::date then raise exception ''This label is planned for %. Scan the label for today.'',a.work_date; end if;'||chr(10)||
     '   perform manufacturing_private.require_person_free(a.person_id,a.id);'||chr(10)||
     ' end if;'||chr(10)||' if not a.active or o.stage<>1 then');
   execute definition;
 end if;
end
$patch$;

-- A direct lookup supports dated labels and older codes without the list API's row limit.
create or replace function manufacturing_private.reusable_barcode(p_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.dumping_assignments;
begin
 select * into a from public.dumping_assignments where id=upper(trim(p_id));
 if not found then raise exception 'Reusable barcode not found';end if;
 perform manufacturing_private.dumping_access(a.sub_job_id,false);
 return jsonb_build_object('id',a.id,'personId',a.person_id,'batchQuantity',a.batch_quantity,'workDate',a.work_date);
end$$;

create or replace function manufacturing_private.day_plan(p_date date,p_job text default null,p_people text[] default null,p_expected text[] default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r text:=manufacturing_private.actor_role(); today date:=(clock_timestamp() at time zone 'America/Chicago')::date;
 j public.sub_jobs; w public.work_orders; o public.orders; pid text; p public.people;
 current_people text[]; selected text[]; other_count int;
begin
 if auth.uid() is null or coalesce(r,'') not in ('admin','manager','coach','station','box_setup') then
   raise exception 'Plan access requires box setup permissions' using errcode='42501';
 end if;
 if p_date is null or not isfinite(p_date) then raise exception 'Select a work date';end if;
 if p_people is not null then
   if p_date<today then raise exception 'Plans for past dates are read-only';end if;
   if p_job is null or p_expected is null or cardinality(p_people)>100 or array_position(p_people,null) is not null then
     raise exception 'Select a sub-job and up to 100 individuals';
   end if;
   perform manufacturing_private.dumping_access(p_job,true);
   select * into j from public.sub_jobs where id=p_job;
   select * into w from public.work_orders where id=j.work_order_id;
   select * into o from public.orders where id=w.order_id for update;
   perform pg_advisory_xact_lock(hashtextextended('day-plan:'||p_date::text,0));
   select * into j from public.sub_jobs where id=p_job for update;
   if o.stage<>1 or j.completed>=j.quantity then raise exception 'Select an unfinished sub-job in production';end if;
   select coalesce(array_agg(distinct id order by id),'{}') into selected from unnest(p_people) id;
   select coalesce(array_agg(person_id order by person_id),'{}') into current_people
   from public.dumping_assignments where sub_job_id=p_job and work_date=p_date and active;
   if selected<>current_people then
     if current_people<>p_expected then raise exception 'This plan changed on another device. Refresh and review it.' using errcode='40001';end if;
     -- Lock people in stable order before changing their assignments.
     perform 1 from public.people where id=any(selected||current_people) order by id for update;
     -- A finished sub-job frees its people for another plan on the same day.
     update public.dumping_assignments a set active=false
     from public.sub_jobs sj join public.work_orders wo on wo.id=sj.work_order_id
       join public.orders ord on ord.id=wo.order_id
     where a.sub_job_id=sj.id and a.work_date=p_date and a.active and a.person_id=any(selected)
       and (sj.completed>=sj.quantity or ord.stage<>1);
     select count(*) into other_count from public.dumping_assignments a
       join public.sub_jobs sj on sj.id=a.sub_job_id join public.work_orders wo on wo.id=sj.work_order_id
       join public.orders ord on ord.id=wo.order_id
       where a.work_date=p_date and a.active and a.sub_job_id<>p_job and sj.completed<sj.quantity and ord.stage=1;
     if other_count+cardinality(selected)>100 then raise exception 'A daily plan can contain up to 100 stickers';end if;
     foreach pid in array selected loop
       if pid=any(current_people) then continue;end if;
       select * into p from public.people where id=pid;
       if p.id is null or p.kind<>'individual' or p.data->>'active'='false' then raise exception 'Select active individuals';end if;
       if exists(select 1 from public.dumping_assignments where person_id=pid and work_date=p_date and active and sub_job_id<>p_job) then
         raise exception '% is already on another sub-job plan for that day',p.name;
       end if;
       if p_date=today then perform manufacturing_private.require_person_free(pid);end if;
     end loop;
     update public.dumping_assignments set active=false
       where sub_job_id=p_job and work_date=p_date and active and not(person_id=any(selected));
     insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,work_date,created_by)
       select 'REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),p_job,id,w.pieces_per_pack,p_date,auth.uid()
       from unnest(selected) id where not(id=any(current_people));
   end if;
 end if;
 return coalesce((
   select jsonb_agg(jsonb_build_object('id',a.id,'jobId',sj.id,'workId',wo.id,'orderId',ord.id,
     'orderTitle',ord.data->>'title','jobName',sj.data->>'name','personId',a.person_id,
     'personName',person.name,'batchQuantity',a.batch_quantity,'workDate',a.work_date)
     order by ord.id,sj.id,person.name,person.id)
   from public.dumping_assignments a join public.sub_jobs sj on sj.id=a.sub_job_id
   join public.work_orders wo on wo.id=sj.work_order_id join public.orders ord on ord.id=wo.order_id
   join public.people person on person.id=a.person_id
   where a.work_date=p_date and a.active and manufacturing_private.can_read_order(ord.id)
     and (p_date<today or (ord.stage=1 and sj.completed<sj.quantity))
     and (r<>'coach' or wo.coach_id=(select person_id from public.staff_profiles where id=auth.uid()))
 ),'[]'::jsonb);
end$$;

create or replace function public.app_reusable_barcode(p_id text) returns jsonb language sql stable security invoker set search_path='' as
 $$select manufacturing_private.reusable_barcode(p_id);$$;
create or replace function public.app_day_plan(p_date date,p_job text default null,p_people text[] default null,p_expected text[] default null)
returns jsonb language sql security invoker set search_path='' as
 $$select manufacturing_private.day_plan(p_date,p_job,p_people,p_expected);$$;

revoke all on function manufacturing_private.reusable_barcode(text),public.app_reusable_barcode(text),
 manufacturing_private.day_plan(date,text,text[],text[]),public.app_day_plan(date,text,text[],text[]) from public,anon;
grant execute on function manufacturing_private.reusable_barcode(text),public.app_reusable_barcode(text),
 manufacturing_private.day_plan(date,text,text[],text[]),public.app_day_plan(date,text,text[],text[]) to authenticated;
commit;
