begin;
do $$
declare
 actor uuid;
 scanner uuid;
 prefix text:='TEST-SCAN-CONFIG-'||gen_random_uuid()::text;
 oid text:=prefix||'-ORDER';
 wid text:=prefix||'-WORK';
 jid text:=prefix||'-JOB';
 pid text:=prefix||'-PERSON';
 qr text:='REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 box text:='BOX-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 today date:=(now() at time zone 'America/Chicago')::date;
 request uuid:=gen_random_uuid();
 receipt jsonb;
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.people(id,name,kind) values(pid,'Rollback scan fixture','individual');
 insert into public.orders(id,customer_id,stage,data)
 values(oid,(select id from public.customers limit 1),1,'{"title":"Rollback scan settings test"}');
 insert into public.work_orders(id,order_id,quantity,pieces_per_pack,data)
 values(wid,oid,100,25,'{"seconds":30,"timingVersion":2}');
 insert into public.sub_jobs(id,work_order_id,quantity) values(jid,wid,100);
 insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,created_by,work_date,plan_approved_at)
 values(qr,jid,pid,25,actor,today,now());
 perform public.app_save_scan_settings(wid,10,12);
 if public.app_reusable_barcode(qr)->>'batchQuantity' is distinct from '12'
   or (select x->>'batchQuantity' from jsonb_array_elements(public.app_approved_day_plans(today)) x where x->>'id'=qr) is distinct from '12'
   or (select pieces_per_pack from public.work_orders where id=wid)<>25
   or manufacturing_private.read_order(oid)#>>'{workOrders,0,scanCooldownSeconds}' is distinct from '10'
 then raise exception 'Override not visible to scanner, label queue, or configuration'; end if;
 begin
   perform public.app_scan_reusable_configured(qr,request,25,25);
   raise exception 'Stale load accepted';
 exception when serialization_failure then null;
 end;
 receipt:=public.app_scan_reusable_configured(qr,request,12,12);
 if receipt->>'pieces' is distinct from '12' then raise exception 'Configured load did not record'; end if;
 update public.dumping_assignments set last_scan_at=clock_timestamp()-interval '15 seconds' where id=qr;
 begin
   perform public.app_scan_reusable_configured(qr,gen_random_uuid(),24,12);
   raise exception '2× cooldown did not apply';
 exception when raise_exception then
   if sqlerrm not like 'Too soon%' then raise; end if;
 end;
 perform public.app_save_scan_settings(wid,0,15);
 if public.app_scan_reusable_configured(qr,request,12,12)->>'duplicate' is distinct from 'true' then
   raise exception 'Retry of a recorded load failed after a settings change';
 end if;
 perform public.app_scan_reusable_configured(qr,gen_random_uuid(),15,15);
 insert into public.boxes(id,sub_job_id,person_id,quantity,completed_pieces,completed_at)
 values(box,jid,pid,25,25,now());
 insert into public.production_records(box_id,completed_pieces,actor_id) values(box,25,actor);
 receipt:=public.app_scan_history(today,today,'all',pid,oid,'',0);
 if receipt->>'total' is distinct from '3' or receipt->>'pieces' is distinct from '52' then
   raise exception 'Combined history returned incorrect counts';
 end if;
 receipt:=public.app_scan_history(today,today,'reusable',pid,oid,qr,0);
 if receipt->>'total' is distinct from '2' or receipt->>'pieces' is distinct from '27' then
   raise exception 'Reusable history filters returned incorrect counts';
 end if;
 perform set_config('request.jwt.claim.sub',scanner::text,true);
 begin
   perform public.app_scan_history(today,today,'all',null,null,'',0);
   raise exception 'Scanner accessed administrative history';
 exception when insufficient_privilege then null;
 end;
 begin
   perform public.app_save_scan_settings(wid,0,20);
   raise exception 'Scanner edited administrative settings';
 exception when insufficient_privilege then null;
 end;
end
$$;
rollback;
