create or replace function manufacturing_private.bulk_attendance(
 p_date date,p_action text,p_time time,p_people jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 target record;
 person public.people;
 entry public.daily_attendance;
 reason text;
 changed integer:=0;
 skipped jsonb:='[]';
begin
 perform manufacturing_private.require_roster();
 if p_date is null or not isfinite(p_date) or p_action is null or p_action not in ('in','out')
   or p_time is null or p_time>=time '24:00' or jsonb_typeof(p_people) is distinct from 'array' then
   raise exception 'Choose a date, an attendance action, a time, and individuals';
 end if;
 if jsonb_array_length(p_people) not between 1 and 500
   or (select count(distinct id) from jsonb_to_recordset(p_people) as x(id text,revision bigint))<>jsonb_array_length(p_people)
 then raise exception 'Select 1–500 distinct individuals'; end if;

 for target in select * from jsonb_to_recordset(p_people) as x(id text,revision bigint) order by id loop
   select * into person from public.people where id=target.id for share;
   select * into entry from public.daily_attendance where person_id=target.id and date=p_date for update;
   reason:=case
     when person.id is null or person.kind<>'individual' or person.data->>'active'='false' then 'Individual is unavailable'
     when p_action='in' and entry.arrival is not null then 'Time In already recorded'
     when p_action='out' and (entry.status is distinct from 'present' or entry.arrival is null) then 'Time In required'
     when p_action='out' and entry.departure is not null then 'Time Out already recorded'
     when p_action='out' and p_time<entry.arrival then 'Time Out is before Time In'
     when p_action='in' and p_time>entry.departure then 'Time In is after Time Out'
   end;
   if reason is not null then
     skipped:=skipped||jsonb_build_array(jsonb_build_object('personId',target.id,'name',coalesce(person.name,target.id),'reason',reason));
     continue;
   end if;
   if coalesce(entry.revision,0) is distinct from target.revision then
     raise exception 'Attendance changed elsewhere. Refresh the roster and retry.' using errcode='40001';
   end if;

   if entry.person_id is null then
     insert into public.daily_attendance(person_id,date,status,arrival,updated_by)
     values(target.id,p_date,'present',p_time,auth.uid())
     on conflict do nothing returning * into entry;
   else
     update public.daily_attendance set status='present',
       arrival=case when p_action='in' then p_time else arrival end,
       departure=case when p_action='out' then p_time else departure end,
       revision=revision+1,updated_at=now(),updated_by=auth.uid()
     where person_id=target.id and date=p_date and revision=target.revision returning * into entry;
   end if;
   if not found then
     raise exception 'Attendance changed elsewhere. Refresh the roster and retry.' using errcode='40001';
   end if;
   insert into public.workforce_changes(kind,person_id,data,actor_id)
   values('attendance',target.id,jsonb_build_object('date',p_date,'status',entry.status,
     'arrival',entry.arrival,'departure',entry.departure,'workHours',entry.work_hours,'source','bulk'),auth.uid());
   changed:=changed+1;
 end loop;
 return jsonb_build_object('records',manufacturing_private.attendance(p_date),'changed',changed,'skipped',skipped);
end;
$$;

create or replace function public.app_bulk_attendance(p_date date,p_action text,p_time time,p_people jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.bulk_attendance(p_date,p_action,p_time,p_people);
$$;
revoke all on function manufacturing_private.bulk_attendance(date,text,time,jsonb),
 public.app_bulk_attendance(date,text,time,jsonb) from public,anon;
grant execute on function manufacturing_private.bulk_attendance(date,text,time,jsonb),
 public.app_bulk_attendance(date,text,time,jsonb) to authenticated;
