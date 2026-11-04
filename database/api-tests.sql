begin;
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000001','manufacturing-db-test@example.invalid');
insert into public.staff_profiles(id,display_name,role) values('00000000-0000-4000-8000-000000000001','Database test','admin');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$declare data jsonb;o jsonb;rev bigint;begin
 data:=public.app_get_workspace();if jsonb_array_length(data->'orders')<10 then raise exception 'Expected at least ten demo orders';end if;
 perform public.app_save_customer('API Test Customer');
 perform public.app_save_person('{"id":"API-TEST-PERSON","name":"API Test Person","kind":"individual","role":"Assembly","hoursPerDay":6}');
 perform public.app_save_order('{"id":"API-TEST-ORDER","title":"API roundtrip","customer":"API Test Customer","quantity":100,"perPack":25,"stage":0,"workOrders":[],"required":"2026-12-01"}',0,'Order created by test');
 data:=public.app_get_workspace();select value into o from jsonb_array_elements(data->'orders') where value->>'id'='API-TEST-ORDER';
 rev:=(o->>'_revision')::bigint;
 perform public.app_save_order(o||'{"title":"API title updated"}',rev,'Title updated');
 begin perform public.app_save_order(o,rev,'Stale write');raise exception 'Stale update was accepted';exception when serialization_failure then null;end;
 data:=public.app_complete_box('DEMO-BOX-001',20);
 if (select completed from public.sub_jobs where id='DEMO-WO-005-SJ-001')<>45 then raise exception 'Completed pieces did not accumulate';end if;
 begin perform public.app_complete_box('DEMO-BOX-001',20);raise exception 'Duplicate completion accepted';exception when raise_exception then if sqlerrm='Duplicate completion accepted' then raise;end if;end;
 data:=public.app_create_box('DEMO-ORD-005','DEMO-WO-005','{"id":"API-TEST-BOX","jobId":"DEMO-WO-005-SJ-001","personId":"API-TEST-PERSON","quantity":25,"date":"2026-11-03"}');
 perform public.app_save_booking('{"id":"API-TEST-BOOKING","personId":"API-TEST-PERSON","orderId":"DEMO-ORD-005","workId":"DEMO-WO-005","start":"2026-11-03","end":"2026-11-04","hours":2}');
 perform public.app_release_booking('API-TEST-BOOKING');
 data:=public.app_get_workspace();select value into o from jsonb_array_elements(data->'orders') where value->>'id'='DEMO-ORD-002';perform public.app_save_order(o,(o->>'_revision')::bigint,'Existing work order roundtrip');
end$$;
reset role;
update public.staff_profiles set role='station' where id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$declare data jsonb;begin
 data:=public.app_get_workspace();if exists(select 1 from jsonb_array_elements(data->'orders') o where o->>'stage'<>'1') then raise exception 'Station can see non-production orders';end if;
 if data#>>'{orders,0,customer}'<>'Production' or data#>'{orders,0,delivery}' is not null then raise exception 'Station customer/delivery fields exposed';end if;
 begin perform public.app_save_customer('Forbidden');raise exception 'Station mutation accepted';exception when insufficient_privilege then null;end;
end$$;
reset role;
update public.staff_profiles set role='coach',person_id='DEMO-COACH-1' where id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$declare data jsonb;begin
 data:=public.app_get_workspace();if exists(select 1 from jsonb_array_elements(data->'orders') o cross join lateral jsonb_array_elements(o->'workOrders') w where w->>'coachId'<>'DEMO-COACH-1') then raise exception 'Coach can see unassigned work';end if;
 begin perform public.app_save_person('{"id":"FORBIDDEN","name":"Forbidden","kind":"coach","hoursPerDay":6}');raise exception 'Coach staff mutation accepted';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
set local role authenticated;
do $$begin begin perform public.app_get_workspace();raise exception 'Unapproved user access accepted';exception when insufficient_privilege then null;end;end$$;
reset role;
select has_function_privilege('anon','public.app_get_workspace()','execute') as anon_workspace_access,
 (select count(*) from pg_tables where schemaname='public' and not rowsecurity) as tables_without_rls;
rollback;
