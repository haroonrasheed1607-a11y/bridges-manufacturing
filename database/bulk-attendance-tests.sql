begin;
do $$
declare
 actor uuid;
 scanner uuid;
 prefix text:='TEST-ATTENDANCE-'||gen_random_uuid()::text;
 a text:=prefix||'-A';
 b text:=prefix||'-B';
 c text:=prefix||'-C';
 d date:=(now() at time zone 'America/Chicago')::date;
 result jsonb;
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.people(id,name,kind) values(a,'Bulk fixture A','individual'),
   (b,'Bulk fixture B','individual'),(c,'Bulk fixture C','individual');

 result:=public.app_bulk_attendance(d,'in','09:00',jsonb_build_array(
   jsonb_build_object('id',a,'revision',0),jsonb_build_object('id',b,'revision',0)));
 if result->>'changed' is distinct from '2'
   or (select count(*) from public.daily_attendance where person_id in (a,b) and date=d
       and status='present' and arrival='09:00' and departure is null and work_hours is null)<>2 then
   raise exception 'Bulk Time In did not mark both individuals present';
 end if;

 perform public.app_attendance(d,a,'present','09:00',null,4,1);
 begin
   perform public.app_bulk_attendance(d,'out','14:00',jsonb_build_array(
     jsonb_build_object('id',b,'revision',1),jsonb_build_object('id',a,'revision',1)));
   raise exception 'Stale bulk update was accepted';
 exception when serialization_failure then null;
 end;
 if exists(select 1 from public.daily_attendance where person_id in (a,b) and date=d and departure is not null) then
   raise exception 'A stale batch was partly committed';
 end if;

 result:=public.app_bulk_attendance(d,'out','14:00',jsonb_build_array(
   jsonb_build_object('id',a,'revision',2),jsonb_build_object('id',b,'revision',1),jsonb_build_object('id',c,'revision',0)));
 if result->>'changed' is distinct from '2' or result#>>'{skipped,0,reason}' is distinct from 'Time In required'
   or (select count(*) from public.daily_attendance where person_id in (a,b) and date=d
     and arrival='09:00' and departure='14:00')<>2
   or (select work_hours from public.daily_attendance where person_id=a and date=d) is distinct from 4
 then raise exception 'Bulk Time Out did not preserve time in and hours'; end if;

 result:=public.app_bulk_attendance(d,'out','15:00',jsonb_build_array(jsonb_build_object('id',a,'revision',3)));
 if result->>'changed' is distinct from '0'
   or (select departure from public.daily_attendance where person_id=a and date=d) is distinct from time '14:00'
 then raise exception 'Existing Time Out was overwritten'; end if;

 perform set_config('request.jwt.claim.sub',scanner::text,true);
 begin
   perform public.app_bulk_attendance(d,'in','09:00',jsonb_build_array(jsonb_build_object('id',c,'revision',0)));
   raise exception 'Scanner accessed bulk attendance';
 exception when insufficient_privilege then null;
 end;
end
$$;
rollback;
