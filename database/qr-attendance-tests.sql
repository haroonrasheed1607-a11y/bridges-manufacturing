begin;
do $$
declare
 admin_id uuid; scanner_id uuid;
 pid text:='TEST-QR-ATTEND-'||gen_random_uuid();
 qr text;
 request_id uuid:=gen_random_uuid();
 result jsonb;
 first_time text;
 first_revision bigint;
 today date:=(clock_timestamp() at time zone 'America/Chicago')::date;
begin
 select id into strict admin_id from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner_id from public.staff_profiles where active and role='box_scanner' limit 1;
 insert into public.people(id,name,kind,data) values(pid,'Rollback QR attendance fixture','individual','{"sourceNumber":"TEST"}');
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 result:=public.app_individual_qr_cards(array[pid],true);
 qr:=result->0->>'code';
 perform set_config('request.jwt.claim.sub',scanner_id::text,true);
 begin
  perform public.app_qr_attendance(qr,'out',gen_random_uuid());
  raise exception 'Time Out without Time In was accepted';
 exception when raise_exception then if sqlerrm not like 'Time In must%' then raise; end if; end;
 if exists(select 1 from public.daily_attendance where person_id=pid) then raise exception 'Failed scan wrote attendance'; end if;
 result:=public.app_qr_attendance(qr,'in',request_id);
 if not result @> jsonb_build_object('personId',pid,'date',today,'action','in','duplicate',false) then raise exception 'Time In was not recorded'; end if;
 first_time:=result->>'time';
 select revision into strict first_revision from public.daily_attendance where person_id=pid and date=today;
 if public.app_qr_attendance(qr,'in',request_id)->>'duplicate' is distinct from 'true' then raise exception 'A retry did not return the receipt'; end if;
 result:=public.app_qr_attendance(qr,'in',gen_random_uuid());
 if result->>'duplicate' is distinct from 'true' or result->>'time' is distinct from first_time
  or (select revision from public.daily_attendance where person_id=pid and date=today)<>first_revision then
  raise exception 'A repeated Time In changed the record';
 end if;
 update public.daily_attendance set work_hours=3.5 where person_id=pid and date=today;
 result:=public.app_qr_attendance(qr,'out',gen_random_uuid());
 if result->>'duplicate' is distinct from 'false' or result->>'departure' is null
  or result->>'arrival' is distinct from first_time
  or (select work_hours from public.daily_attendance where person_id=pid and date=today)<>3.5 then
  raise exception 'Time Out changed Time In or recorded work hours';
 end if;
 if public.app_qr_attendance(qr,'out',gen_random_uuid())->>'duplicate' is distinct from 'true' then
  raise exception 'A repeated Time Out was recorded';
 end if;
 if (select count(*) from public.workforce_changes where person_id=pid and data->>'source'='qr')<>2 then
  raise exception 'Attendance audit did not record exactly one arrival and one departure';
 end if;
 begin
  perform public.app_qr_attendance(qr,'out',request_id);
  raise exception 'Request reference accepted a different action';
 exception when raise_exception then if sqlerrm not like 'This attendance request%' then raise; end if; end;
 update public.people set data=data||'{"active":false}' where id=pid;
 begin
  perform public.app_qr_attendance(qr,'in',gen_random_uuid());
  raise exception 'Disabled individual was accepted';
 exception when raise_exception then if sqlerrm<>'This individual is disabled' then raise; end if; end;
 update public.people set data=data||'{"active":true}',job_qr_expires_on=today-1 where id=pid;
 begin
  perform public.app_qr_attendance(qr,'in',gen_random_uuid());
  raise exception 'Expired QR was accepted';
 exception when raise_exception then if sqlerrm not like 'This QR card has expired%' then raise; end if; end;
 begin
  perform public.app_attendance(today);
  raise exception 'Scanner received full roster permissions';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.app_qr_attendance(qr,'in',gen_random_uuid());
  raise exception 'Anonymous QR attendance was accepted';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
