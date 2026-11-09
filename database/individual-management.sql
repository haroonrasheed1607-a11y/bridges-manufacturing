begin;

create or replace function manufacturing_private.save_person(p_person jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare weekly jsonb:=p_person->'weeklyHours';
begin
 perform manufacturing_private.require_manager();
 if weekly is not null and weekly<>'null'::jsonb then
   if jsonb_typeof(weekly)<>'array' or jsonb_array_length(weekly)<>7 then
     raise exception 'Enter seven days of weekly availability';
   end if;
   if exists(select 1 from jsonb_array_elements(weekly) h
     where case when jsonb_typeof(h)='number' then (h::text)::numeric not between 0 and 24 else true end) then
     raise exception 'Weekly availability must be between 0 and 24 hours per day';
   end if;
 end if;
 insert into public.people(id,name,kind,hours_per_day,data)
 values(p_person->>'id',trim(p_person->>'name'),p_person->>'kind',(p_person->>'hoursPerDay')::numeric,p_person-'active')
 on conflict(id) do update set name=excluded.name,kind=excluded.kind,hours_per_day=excluded.hours_per_day,
   data=people.data||excluded.data;
 return manufacturing_private.workspace();
end$$;

create or replace function manufacturing_private.set_individual_active(p_person text,p_active boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform manufacturing_private.require_manager();
 if p_active is null then raise exception 'Choose enabled or disabled';end if;
 update public.people set data=data||jsonb_build_object('active',p_active) where id=p_person and kind='individual';
 if not found then raise exception 'Select an individual';end if;
 insert into public.workforce_changes(kind,person_id,data,actor_id)
 values('individual_status',p_person,jsonb_build_object('active',p_active),auth.uid());
 return manufacturing_private.workspace();
end$$;

create or replace function manufacturing_private.import_individuals(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb; display_name text; normalized text; seen text[]:='{}'; skill text; hours numeric; target text; person_id text;
begin
 perform manufacturing_private.require_manager();
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500 then
   raise exception 'Import between 1 and 500 individuals';
 end if;
 -- Check duplicate decisions against current data, including concurrent imports and edits.
 lock table public.people in share row exclusive mode;
 for item in select value from jsonb_array_elements(p_rows) loop
   display_name:=trim(regexp_replace(coalesce(item->>'name',''),'[[:space:]]+',' ','g'));
   normalized:=lower(display_name);
   skill:=nullif(trim(item->>'role'),'');
   hours:=(item->>'hoursPerDay')::numeric;
   target:=nullif(item->>'existingId','');
   if length(display_name) not between 1 and 160 or length(skill)>240 or (hours is not null and (hours<=0 or hours>24)) then
     raise exception 'Invalid individual name, role or hours: %',display_name;
   end if;
   if normalized=any(seen) then raise exception 'Repeated name in import: %',display_name;end if;
   seen:=array_append(seen,normalized);
   if target is not null then
     update public.people set name=display_name,hours_per_day=coalesce(hours,hours_per_day),
       data=data||case when skill is null then '{}'::jsonb else jsonb_build_object('role',skill) end
     where id=target and kind='individual' and lower(trim(regexp_replace(name,'[[:space:]]+',' ','g')))=normalized
     returning id into person_id;
     if not found then raise exception 'The matching individual changed. Reload and review % again.',display_name;end if;
   else
     if exists(select 1 from public.people where kind='individual' and lower(trim(regexp_replace(name,'[[:space:]]+',' ','g')))=normalized) then
       raise exception '% already exists. Reload the workbook and confirm the matching individual.',display_name;
     end if;
     person_id:='PERSON-'||gen_random_uuid()::text;
     insert into public.people(id,name,kind,hours_per_day,data)
     values(person_id,display_name,'individual',coalesce(hours,6),jsonb_build_object('role',coalesce(skill,'')));
   end if;
   insert into public.workforce_changes(kind,person_id,data,actor_id)
   values('individual_import',person_id,jsonb_build_object('updated',target is not null),auth.uid());
 end loop;
 return manufacturing_private.workspace();
end$$;

create or replace function manufacturing_private.save_booking(p_booking jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.work_orders; o public.orders; p public.people;
 start_day date:=(p_booking->>'start')::date; end_day date:=(p_booking->>'end')::date;
 allocated jsonb;
begin
 perform manufacturing_private.require_manager();
 select * into w from public.work_orders where id=p_booking->>'workId';
 select * into o from public.orders where id=w.order_id;
 if w.id is null or o.stage>1 or o.id<>p_booking->>'orderId' then raise exception 'Select an active work order';end if;
 select * into p from public.people where id=p_booking->>'personId' for update;
 if p.id is null or p.data->>'active'='false' then raise exception 'Select an active individual';end if;
 if start_day is null or end_day is null or end_day<start_day or end_day-start_day>3659 then
   raise exception 'Choose a valid date range of up to 3660 days';
 end if;
 select jsonb_agg(d::date order by d) into allocated
 from generate_series(start_day::timestamp,end_day::timestamp,interval '1 day') d
 where coalesce((p.data->'weeklyHours'->>(extract(isodow from d)::int-1))::numeric,
   case when extract(isodow from d)<6 then p.hours_per_day else 0 end)>0;
 if allocated is null then raise exception 'Booking must contain an available day';end if;
 insert into public.bookings(id,person_id,order_id,work_order_id,starts_on,ends_on,hours,status,data)
 values(p_booking->>'id',p.id,o.id,w.id,start_day,end_day,(p_booking->>'hours')::numeric,'booked',p_booking||jsonb_build_object('allocatedDates',allocated))
 on conflict(id) do update set person_id=excluded.person_id,starts_on=excluded.starts_on,ends_on=excluded.ends_on,
   hours=excluded.hours,status='booked',data=excluded.data
 where bookings.order_id=excluded.order_id and bookings.work_order_id=excluded.work_order_id;
 return manufacturing_private.workspace();
end$$;

create or replace function public.app_import_individuals(p_rows jsonb)
returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.import_individuals(p_rows);$$;
create or replace function public.app_set_individual_active(p_person text,p_active boolean)
returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.set_individual_active(p_person,p_active);$$;

revoke all on function manufacturing_private.import_individuals(jsonb),manufacturing_private.set_individual_active(text,boolean),
 public.app_import_individuals(jsonb),public.app_set_individual_active(text,boolean) from public,anon;
grant execute on function manufacturing_private.import_individuals(jsonb),manufacturing_private.set_individual_active(text,boolean),
 public.app_import_individuals(jsonb),public.app_set_individual_active(text,boolean) to authenticated;

commit;
