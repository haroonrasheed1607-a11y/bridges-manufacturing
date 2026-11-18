DO $$BEGIN IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id='STAGE-CLIENT') THEN RAISE EXCEPTION 'Attendance card migration is for staging only'; END IF; END$$;
create table manufacturing_private.personal_qr_types (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 60 and lower(trim(name))<>'generic'),
 purpose text not null default 'attendance' check(purpose='attendance')
);
create unique index personal_qr_type_name on manufacturing_private.personal_qr_types(lower(trim(name)));
insert into manufacturing_private.personal_qr_types(name) values ('Attendance');
create table manufacturing_private.attendance_cards (
 person_id text primary key references public.people(id),
 type_id uuid not null references manufacturing_private.personal_qr_types(id),
 code text unique not null,
 generated_on date not null default ((now() at time zone 'America/Chicago')::date)
);
alter table manufacturing_private.personal_qr_types enable row level security;
alter table manufacturing_private.attendance_cards enable row level security;
revoke all on manufacturing_private.personal_qr_types,manufacturing_private.attendance_cards from public,anon,authenticated,service_role;

create function manufacturing_private.personal_qr_types(p_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform manufacturing_private.require_manager();
 if p_name is not null then
  if manufacturing_private.actor_role() is distinct from 'admin' then raise insufficient_privilege; end if;
  insert into manufacturing_private.personal_qr_types(name) values(trim(p_name));
 end if;
 return (select coalesce(jsonb_agg(to_jsonb(t) order by name),'[]') from manufacturing_private.personal_qr_types t);
end $$;

create function manufacturing_private.attendance_cards(p_type uuid,p_people text[],p_issue boolean,p_replace boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare card_type manufacturing_private.personal_qr_types; selected_id text;
begin
 perform manufacturing_private.require_manager();
 if coalesce(cardinality(p_people),0) not between 1 and 100 or array_position(p_people,null) is not null then
  raise exception 'Select 1 to 100 individuals';
 end if;
 select * into strict card_type from manufacturing_private.personal_qr_types where id=p_type;
 if p_replace and (manufacturing_private.actor_role() is distinct from 'admin' or cardinality(p_people)<>1 or p_issue is distinct from true) then
  raise insufficient_privilege;
 end if;
 perform 1 from public.people p where p.id=any(p_people) order by p.id for update;
 for selected_id in select distinct unnest(p_people) loop
  if not exists(select 1 from public.people p where p.id=selected_id and p.kind='individual' and p.data->>'active' is distinct from 'false') then
   raise exception 'Select active individuals';
  end if;
 end loop;
 if p_issue then
  if exists(select 1 from manufacturing_private.attendance_cards c where c.person_id=any(p_people) and c.type_id<>p_type) and not coalesce(p_replace,false) then
   raise exception 'An individual already has a different Attendance card type. Replace it from their profile.';
  end if;
  insert into manufacturing_private.attendance_cards as current_card(person_id,type_id,code)
   select distinct p, p_type, 'ATT-'||upper(replace(gen_random_uuid()::text,'-','')) from (select distinct unnest(p_people) p) people
   on conflict on constraint attendance_cards_pkey do update
   set code=excluded.code,type_id=excluded.type_id,generated_on=excluded.generated_on
   where p_replace;
 end if;
 return (select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'number',p.data->>'sourceNumber',
   'active',true,'code',c.code,'generatedOn',c.generated_on,'expiresOn',null,'type',card_type.name) order by p.name,p.id)
   from public.people p left join manufacturing_private.attendance_cards c on c.person_id=p.id and c.type_id=p_type
   where p.id=any(p_people));
end $$;

create function public.app_personal_qr_types(p_name text default null) returns jsonb
language sql security invoker set search_path='' as $$select manufacturing_private.personal_qr_types(p_name)$$;
create function public.app_attendance_cards(p_type uuid,p_people text[],p_issue boolean,p_replace boolean default false) returns jsonb
language sql security invoker set search_path='' as $$select manufacturing_private.attendance_cards(p_type,p_people,p_issue,p_replace)$$;
revoke all on function public.app_personal_qr_types(text),public.app_attendance_cards(uuid,text[],boolean,boolean),manufacturing_private.personal_qr_types(text),manufacturing_private.attendance_cards(uuid,text[],boolean,boolean) from public,anon,service_role;
grant execute on function public.app_personal_qr_types(text),public.app_attendance_cards(uuid,text[],boolean,boolean),manufacturing_private.personal_qr_types(text),manufacturing_private.attendance_cards(uuid,text[],boolean,boolean) to authenticated;

do $patch$
declare original text; revised text;
begin
 original:=pg_get_functiondef('manufacturing_private.qr_attendance(text,text,uuid)'::regprocedure);
 revised:=replace(original,'where job_qr_code=upper(trim(p_code)) and kind=', 'where (job_qr_code=upper(trim(p_code)) or id=(select c.person_id from manufacturing_private.attendance_cards c where c.code=upper(trim(p_code)))) and kind=');
 if revised=original then raise exception 'Unexpected attendance QR lookup'; end if;
 original:=revised;
 revised:=replace(original,'local_now:=clock_timestamp()', $rule$
 if exists(select 1 from manufacturing_private.attendance_cards c where c.person_id=person.id and c.code is distinct from upper(trim(p_code))) then
  raise exception 'Scan this individual’s dedicated Attendance card';
 end if;
 local_now:=clock_timestamp()$rule$);
 if revised=original then raise exception 'Unexpected attendance clock'; end if;
 revised:=replace(revised,'if person.job_qr_expires_on<attendance_day', 'if person.job_qr_code=upper(trim(p_code)) and person.job_qr_expires_on<attendance_day');
 revised:=replace(revised,'where id=receipt.person_id and job_qr_code=upper(trim(p_code))','where id=receipt.person_id and (job_qr_code=upper(trim(p_code)) or id=(select c.person_id from manufacturing_private.attendance_cards c where c.code=upper(trim(p_code))))');
 execute revised;
end $patch$;

do $patch$
declare original text; revised text;
begin
 original:=pg_get_functiondef('manufacturing_private.attendance(date,text,text,time,time,numeric,bigint)'::regprocedure);
 revised:=replace(original,'if p_status is not null then',$rule$if p_status is not null then
  perform 1 from public.people where id=p_person for share;
  if exists(select 1 from manufacturing_private.attendance_cards c where c.person_id=p_person) then
   raise exception 'Scan this individual’s dedicated Attendance card';
  end if;$rule$);
 if revised=original then raise exception 'Unexpected manual attendance function'; end if;
 execute revised;
 select pg_get_functiondef(p.oid) into strict original from pg_proc p where p.pronamespace='manufacturing_private'::regnamespace and p.proname='bulk_attendance';
 revised:=replace(original,'reason:=case', $rule$reason:=case
     when exists(select 1 from manufacturing_private.attendance_cards c where c.person_id=target.id) then 'Dedicated Attendance card required'$rule$);
 if revised=original then raise exception 'Unexpected bulk attendance function'; end if;
 execute revised;
end $patch$;
