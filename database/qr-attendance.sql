begin;
create table public.attendance_qr_receipts(
 request_id uuid primary key,
 person_id text not null references public.people(id),
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('in','out')),
 result jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.attendance_qr_receipts enable row level security;
revoke all on public.attendance_qr_receipts from public,anon,authenticated;
create index attendance_qr_person_idx on public.attendance_qr_receipts(person_id,created_at);
create index attendance_qr_actor_idx on public.attendance_qr_receipts(actor_id);

create function manufacturing_private.qr_attendance(p_code text,p_action text,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 person public.people; entry public.daily_attendance; receipt public.attendance_qr_receipts;
 local_now timestamp; attendance_day date; attendance_time time;
 created boolean:=false; duplicate boolean:=false; result jsonb;
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in
   ('admin','manager','coach','station','box_setup','box_scanner') then
   raise exception 'Shop Floor access required' using errcode='42501';
 end if;
 if p_action is null or p_action not in ('in','out') or p_request is null then
   raise exception 'Choose Time In or Time Out and scan an individual QR card';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('attendance-qr:'||p_request::text,0));
 select * into receipt from public.attendance_qr_receipts where request_id=p_request;
 if receipt.request_id is not null then
   if receipt.actor_id<>auth.uid() or receipt.action<>p_action or not exists(
     select 1 from public.people where id=receipt.person_id and job_qr_code=upper(trim(p_code))
   ) then raise exception 'This attendance request reference is already used'; end if;
   return receipt.result||jsonb_build_object('duplicate',true);
 end if;
 select * into person from public.people where job_qr_code=upper(trim(p_code)) and kind='individual' for update;
 if person.id is null then raise exception 'Scan a system-generated Individual Job QR card'; end if;
 local_now:=clock_timestamp() at time zone 'America/Chicago';
 attendance_day:=local_now::date;
 attendance_time:=date_trunc('second',local_now)::time;
 if person.data->>'active'='false' then raise exception 'This individual is disabled'; end if;
 if person.job_qr_expires_on<attendance_day then raise exception 'This QR card has expired. Ask a manager to renew it'; end if;
 select * into entry from public.daily_attendance where person_id=person.id and date=attendance_day for update;
 if entry.person_id is null and p_action='in' then
   insert into public.daily_attendance(person_id,date,status,arrival,updated_by)
   values(person.id,attendance_day,'present',attendance_time,auth.uid())
   on conflict do nothing returning * into entry;
   created:=found;
   if not created then
     select * into entry from public.daily_attendance where person_id=person.id and date=attendance_day for update;
   end if;
 end if;
 if not created then
   if p_action='in' and entry.arrival is not null then duplicate:=true;
   elsif p_action='out' and entry.departure is not null then duplicate:=true;
   else
     if p_action='out' and (entry.person_id is null or entry.arrival is null or entry.status is distinct from 'present') then
       raise exception 'Time In must be recorded before Time Out';
     end if;
     if p_action='out' and attendance_time<entry.arrival then raise exception 'Time Out cannot be before Time In'; end if;
     if p_action='in' and entry.departure is not null and attendance_time>entry.departure then raise exception 'Review this attendance record in the roster'; end if;
     update public.daily_attendance set status='present',
       arrival=case when p_action='in' then attendance_time else arrival end,
       departure=case when p_action='out' then attendance_time else departure end,
       revision=revision+1,updated_at=now(),updated_by=auth.uid()
     where person_id=person.id and date=attendance_day returning * into entry;
   end if;
 end if;
 if not duplicate then
   insert into public.workforce_changes(kind,person_id,actor_id,data)
   values('attendance',person.id,auth.uid(),jsonb_build_object('date',attendance_day,'status',entry.status,
     'arrival',entry.arrival,'departure',entry.departure,'workHours',entry.work_hours,'source','qr','action',p_action));
 end if;
 result:=jsonb_build_object('personId',person.id,'name',person.name,'number',person.data->>'sourceNumber',
   'date',attendance_day,'action',p_action,'duplicate',duplicate,
   'time',to_char(case when p_action='in' then entry.arrival else entry.departure end,'HH24:MI:SS'),
   'arrival',to_char(entry.arrival,'HH24:MI:SS'),'departure',to_char(entry.departure,'HH24:MI:SS'));
 insert into public.attendance_qr_receipts(request_id,person_id,actor_id,action,result)
 values(p_request,person.id,auth.uid(),p_action,result);
 return result;
end $$;

create function public.app_qr_attendance(p_code text,p_action text,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.qr_attendance(p_code,p_action,p_request);
$$;
revoke all on function manufacturing_private.qr_attendance(text,text,uuid),public.app_qr_attendance(text,text,uuid) from public,anon;
grant execute on function manufacturing_private.qr_attendance(text,text,uuid),public.app_qr_attendance(text,text,uuid) to authenticated;
commit;
