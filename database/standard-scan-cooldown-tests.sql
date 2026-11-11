begin;
do $$
declare
 actor uuid; scanner uuid; prefix text:='TEST-SCAN-GAP-'||gen_random_uuid();
 person text:=prefix||'-PERSON'; qr text:='REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 snapshot jsonb; work jsonb;
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.people(id,name,kind) values(person,'Rollback scan gap fixture','individual');
 insert into public.orders(id,customer_id,stage,data)
 values(prefix,(select id from public.customers limit 1),0,'{"title":"Rollback scan gap fixture","quantity":500,"perPack":25}');
 snapshot:=manufacturing_private.read_order(prefix);
 work:=jsonb_build_object('id',prefix,'type','Packaging','description','Scan gap fixture','instructions','Test',
   'quantity',500,'perPack',25,'seconds',30,'packSeconds',20,'hoursPerDay',6,
   'scanCooldownSeconds',75,'jobs',jsonb_build_array(jsonb_build_object('id',prefix,'name','Sub-job','quantity',500,'completed',0)));
 perform public.app_save_order(jsonb_set(snapshot,'{workOrders}',jsonb_build_array(work)),(snapshot->>'_revision')::bigint,'Fixture creation');
 if (select scan_cooldown_seconds from public.work_orders where id=prefix) is distinct from 75 then
   raise exception 'New work-order scan interval was not stored';
 end if;
 snapshot:=manufacturing_private.read_order(prefix);
 perform public.app_save_order(jsonb_set(snapshot,'{workOrders,0,scanCooldownSeconds}','90'),(snapshot->>'_revision')::bigint,'Fixture edit');
 if (select scan_cooldown_seconds from public.work_orders where id=prefix) is distinct from 90 then
   raise exception 'Edited work-order scan interval was not stored';
 end if;
 update public.staff_profiles set role='manager' where id=actor;
 if manufacturing_private.read_order(prefix)#>>'{workOrders,0,scanCooldownSeconds}' is distinct from '90' then
   raise exception 'Manager cannot read the editable scan interval';
 end if;
 update public.staff_profiles set role='admin' where id=actor;
 update public.orders set stage=1 where id=prefix;
 update public.work_orders set scan_cooldown_seconds=null where id=prefix;
 insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,created_by)
 values(qr,prefix,person,25,actor);
 perform set_config('request.jwt.claim.sub',scanner::text,true);
 perform public.app_dumping_scan(qr,gen_random_uuid(),25);
 update public.dumping_assignments set last_scan_at=clock_timestamp()-interval '119 seconds' where id=qr;
 begin
   perform public.app_dumping_scan(qr,gen_random_uuid(),25);
   raise exception 'A scan was allowed before the standard 120-second interval';
 exception when raise_exception then if sqlerrm not like 'Too soon%' then raise; end if; end;
 update public.dumping_assignments set last_scan_at=clock_timestamp()-interval '121 seconds' where id=qr;
 perform public.app_dumping_scan(qr,gen_random_uuid(),25);
 update public.dumping_assignments set last_scan_at=clock_timestamp()-interval '121 seconds' where id=qr;
 begin
   perform public.app_dumping_scan(qr,gen_random_uuid(),50);
   raise exception 'A double load was allowed before 240 seconds';
 exception when raise_exception then if sqlerrm not like 'Too soon%' then raise; end if; end;
end $$;
rollback;
