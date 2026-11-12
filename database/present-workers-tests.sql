begin;
do $$
declare scanner uuid; prefix text:='TEST-PRESENT-'||gen_random_uuid(); result jsonb;
 today date:=(statement_timestamp() at time zone 'America/Chicago')::date;
begin
 select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
 insert into public.people(id,name,kind,data) values
 (prefix||'-IN','Present fixture','individual','{"sourceNumber":"TEST-225"}'),
 (prefix||'-OUT','Left fixture','individual','{}'),(prefix||'-ABSENT','Absent fixture','individual','{}'),
 (prefix||'-YESTERDAY','Yesterday fixture','individual','{}'),(prefix||'-COACH','Coach fixture','coach','{}');
 insert into public.daily_attendance(person_id,date,status,arrival,departure,updated_by) values
 (prefix||'-IN',today,'present','09:00',null,scanner),
 (prefix||'-OUT',today,'present','09:00','12:00',scanner),
 (prefix||'-ABSENT',today,'absent',null,null,scanner),
 (prefix||'-YESTERDAY',today-1,'present','09:00',null,scanner),
 (prefix||'-COACH',today,'present','09:00',null,scanner);
 perform set_config('request.jwt.claim.sub',scanner::text,true);
 result:=public.app_present_workers();
 if result->>'date'<>today::text or not result->'people' @> jsonb_build_array(jsonb_build_object('id',prefix||'-IN','number','TEST-225','timeIn','09:00')) then raise exception 'Present person missing %',result;end if;
 if (select count(*) from jsonb_array_elements(result->'people') p where p->>'id' like prefix||'%')<>1 then raise exception 'Absent, timed-out, previous-day or coach included';end if;
 update public.daily_attendance set departure='13:00' where person_id=prefix||'-IN' and date=today;
 if public.app_present_workers()->'people' @> jsonb_build_array(jsonb_build_object('id',prefix||'-IN')) then raise exception 'Time Out did not remove person';end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.app_present_workers();raise exception 'Unsigned access allowed';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.app_present_workers()','execute') then raise exception 'Anonymous roster access';end if;
end $$;
rollback;
