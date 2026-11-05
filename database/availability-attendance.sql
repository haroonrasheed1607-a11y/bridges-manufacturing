-- Apply after schema.sql. Checked RPCs are the only client access path.
begin;
create table public.individual_availability (
 person_id text not null references public.people(id), date date not null,
 status text not null check(status in ('available','unavailable','unknown')),
 hours numeric not null check(hours between 0 and 24),
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
 primary key(person_id,date), check(status='available' or hours=0)
);
create index availability_date_idx on public.individual_availability(date);
create table public.daily_attendance (
 person_id text not null references public.people(id),date date not null,
 status text not null check(status in ('present','absent','excused')),
 arrival time,departure time,work_hours numeric check(work_hours between 0 and 24),
 revision bigint not null default 1,updated_at timestamptz not null default now(),updated_by uuid references auth.users(id),
 primary key(person_id,date),check(departure is null or arrival is not null and departure>=arrival),
 check(status='present' or arrival is null and departure is null and coalesce(work_hours,0)=0)
);
create index attendance_date_idx on public.daily_attendance(date);
create table public.workforce_changes(id uuid primary key default gen_random_uuid(),kind text not null,person_id text not null references public.people(id),data jsonb not null,actor_id uuid references auth.users(id),at timestamptz not null default now());
create index workforce_changes_person_idx on public.workforce_changes(person_id,at);
create index workforce_changes_actor_idx on public.workforce_changes(actor_id);
alter table public.individual_availability enable row level security;
alter table public.daily_attendance enable row level security;
alter table public.workforce_changes enable row level security;
revoke all on public.individual_availability,public.daily_attendance,public.workforce_changes from public,anon,authenticated;
create function manufacturing_private.require_roster() returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('admin','manager','coach') then raise exception 'Manager or Job Coach access required' using errcode='42501';end if;
end$$;
create function manufacturing_private.availability(p_start date,p_end date,p_person text default null,p_status text default null,p_hours numeric default 0,p_weekdays integer[] default array[1,2,3,4,5]) returns jsonb language plpgsql security definer set search_path='' as $$declare day date;begin
 perform manufacturing_private.require_roster();
 if p_start is null or p_end is null or p_end<p_start or p_end-p_start>366 then raise exception 'Select a range of at most one year';end if;
 if p_status is not null then
  if p_person is null or not exists(select 1 from public.people where id=p_person and kind='individual') then raise exception 'Select an individual';end if;
  if p_status not in ('available','unavailable','unknown') or p_hours is null or p_hours<0 or p_hours>24 or p_weekdays is null or cardinality(p_weekdays)=0 or not p_weekdays<@array[0,1,2,3,4,5,6] then raise exception 'Invalid availability';end if;
  for day in select d::date from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d where extract(dow from d)::integer=any(p_weekdays) loop
   insert into public.individual_availability(person_id,date,status,hours,updated_by) values(p_person,day,p_status,case when p_status='available' then p_hours else 0 end,auth.uid())
   on conflict(person_id,date) do update set status=excluded.status,hours=excluded.hours,updated_at=now(),updated_by=auth.uid();
  end loop;
  insert into public.workforce_changes(kind,person_id,data,actor_id) values('availability',p_person,jsonb_build_object('start',p_start,'end',p_end,'status',p_status,'hours',p_hours,'weekdays',p_weekdays),auth.uid());
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('personId',person_id,'date',date,'status',status,'hours',hours) order by date,person_id) from public.individual_availability where date between p_start and p_end and (p_person is null or person_id=p_person)),'[]');
end$$;
create function manufacturing_private.attendance(p_date date,p_person text default null,p_status text default null,p_arrival time default null,p_departure time default null,p_work_hours numeric default null,p_revision bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform manufacturing_private.require_roster();
 if p_date is null then raise exception 'Choose a date';end if;
 if p_status is not null then
  if p_person is null or not exists(select 1 from public.people where id=p_person and kind='individual') then raise exception 'Select an individual';end if;
  if p_status not in ('present','absent','excused') then raise exception 'Invalid attendance status';end if;
  if p_revision=0 then
   insert into public.daily_attendance(person_id,date,status,arrival,departure,work_hours,updated_by) values(p_person,p_date,p_status,p_arrival,p_departure,p_work_hours,auth.uid()) on conflict do nothing;
  else
   update public.daily_attendance set status=p_status,arrival=p_arrival,departure=p_departure,work_hours=p_work_hours,revision=revision+1,updated_at=now(),updated_by=auth.uid() where person_id=p_person and date=p_date and revision=p_revision;
  end if;
  if not found then raise exception 'Attendance changed elsewhere. Refresh and retry.' using errcode='40001';end if;
  insert into public.workforce_changes(kind,person_id,data,actor_id) values('attendance',p_person,jsonb_build_object('date',p_date,'status',p_status,'arrival',p_arrival,'departure',p_departure,'workHours',p_work_hours),auth.uid());
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('personId',person_id,'date',date,'status',status,'arrival',to_char(arrival,'HH24:MI'),'departure',to_char(departure,'HH24:MI'),'workHours',work_hours,'revision',revision) order by person_id) from public.daily_attendance where date=p_date),'[]');
end$$;
create function public.app_availability(p_start date,p_end date,p_person text default null,p_status text default null,p_hours numeric default 0,p_weekdays integer[] default array[1,2,3,4,5]) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.availability(p_start,p_end,p_person,p_status,p_hours,p_weekdays);$$;
create function public.app_attendance(p_date date,p_person text default null,p_status text default null,p_arrival time default null,p_departure time default null,p_work_hours numeric default null,p_revision bigint default 0) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.attendance(p_date,p_person,p_status,p_arrival,p_departure,p_work_hours,p_revision);$$;
revoke all on function manufacturing_private.require_roster(),manufacturing_private.availability(date,date,text,text,numeric,integer[]),manufacturing_private.attendance(date,text,text,time,time,numeric,bigint),public.app_availability(date,date,text,text,numeric,integer[]),public.app_attendance(date,text,text,time,time,numeric,bigint) from public,anon;
grant execute on function manufacturing_private.require_roster(),manufacturing_private.availability(date,date,text,text,numeric,integer[]),manufacturing_private.attendance(date,text,text,time,time,numeric,bigint),public.app_availability(date,date,text,text,numeric,integer[]),public.app_attendance(date,text,text,time,time,numeric,bigint) to authenticated;
commit;
