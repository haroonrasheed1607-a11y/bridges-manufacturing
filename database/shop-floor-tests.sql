-- Rollback-only integration test; requires seeded demo production work and provisioned shop-floor users.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.staff_profiles where role='box_setup' and active limit 1),true);
set local role authenticated;
do $$declare data jsonb;begin
 data:=public.app_get_workspace();
 if jsonb_array_length(data->'orders')=0 then raise exception 'No production fixtures';end if;
 if exists(select 1 from jsonb_array_elements(data->'orders') o where o->>'stage'<>'1' or o->>'customer'<>'Production' or o ? 'delivery') then raise exception 'Setup workspace exposes restricted data';end if;
 begin perform public.app_complete_box('DEMO-BOX-001',1);raise exception 'Setup completed a box';exception when insufficient_privilege then null;end;
 begin perform public.app_save_customer('Forbidden');raise exception 'Setup edited a customer';exception when insufficient_privilege then null;end;
 begin perform public.app_save_order('{}',0,'Forbidden');raise exception 'Setup edited an order';exception when insufficient_privilege then null;end;
 perform public.app_create_box('DEMO-ORD-005','DEMO-WO-005','{"id":"SHOP-FLOOR-TEST-BOX","jobId":"DEMO-WO-005-SJ-001","personId":"DEMO-PERSON-1","quantity":1,"date":"2026-11-03"}');
end$$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from public.staff_profiles where role='box_scanner' and active limit 1),true);
set local role authenticated;
do $$declare data jsonb;begin
 data:=public.app_get_workspace();
 if exists(select 1 from jsonb_array_elements(data->'orders') o where o->>'stage'<>'1' or o->>'customer'<>'Production' or o ? 'delivery') then raise exception 'Scanner workspace exposes restricted data';end if;
 begin perform public.app_create_box('DEMO-ORD-005','DEMO-WO-005','{}');raise exception 'Scanner created a box';exception when insufficient_privilege then null;end;
 begin perform public.app_save_person('{}');raise exception 'Scanner edited staff';exception when insufficient_privilege then null;end;
 perform public.app_complete_box('SHOP-FLOOR-TEST-BOX',1);
 begin perform public.app_complete_box('SHOP-FLOOR-TEST-BOX',1);raise exception 'Duplicate completion accepted';exception when raise_exception then if sqlerrm='Duplicate completion accepted' then raise;end if;end;
end$$;
reset role;
do $$begin
 if not exists(select 1 from public.boxes where id='SHOP-FLOOR-TEST-BOX' and completed_pieces=1 and completed_at is not null) then raise exception 'Box not completed';end if;
 if not exists(select 1 from public.production_records r join public.staff_profiles p on p.id=r.actor_id where r.box_id='SHOP-FLOOR-TEST-BOX' and p.role='box_scanner') then raise exception 'Missing scanner audit record';end if;
 if has_function_privilege('anon','public.app_create_box(text,text,jsonb)','execute') then raise exception 'Anonymous box access';end if;
end$$;
rollback;
