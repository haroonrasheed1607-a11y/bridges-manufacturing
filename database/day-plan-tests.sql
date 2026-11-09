begin;
do $$
declare actor uuid; scanner uuid; uid1 text:='TEST-PLAN-PERSON-1'; uid2 text:='TEST-PLAN-PERSON-2';
 oid text:='TEST-PLAN-ORDER'; wid text:='TEST-PLAN-WORK'; jid text:='TEST-PLAN-JOB'; jid2 text:='TEST-PLAN-JOB-2';
 today date:=(now() at time zone 'America/Chicago')::date; rows jsonb;
 first_code text; second_code text; future_code text;
begin
 select id into actor from public.staff_profiles where active and role='admin' limit 1;
 select id into scanner from public.staff_profiles where active and role='box_scanner' limit 1;
 if actor is null or scanner is null then raise exception 'Admin and scanner profiles required';end if;
 insert into public.people(id,name,kind) values(uid1,'Plan fixture A','individual'),(uid2,'Plan fixture B','individual');
 insert into public.orders(id,customer_id,stage,data) values(oid,(select id from public.customers limit 1),1,'{"title":"Rollback test"}');
 insert into public.work_orders(id,order_id,quantity,pieces_per_pack) values(wid,oid,75,25);
 insert into public.sub_jobs(id,work_order_id,quantity,data) values(jid,wid,50,'{"name":"First job"}'),(jid2,wid,25,'{"name":"Second job"}');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 rows:=public.app_day_plan(today+1,jid,array[uid1],'{}');
 select x->>'id' into strict future_code from jsonb_array_elements(rows) x where x->>'personId'=uid1;
 perform manufacturing_private.require_person_free(uid1);
 rows:=public.app_day_plan(today,jid,array[uid1,uid2],'{}');
 select x->>'id' into strict first_code from jsonb_array_elements(rows) x where x->>'personId'=uid1;
 select x->>'id' into strict second_code from jsonb_array_elements(rows) x where x->>'personId'=uid2;
 if (select completed from public.sub_jobs where id=jid)<>0 then raise exception 'Planning changed completed pieces';end if;
 rows:=public.app_day_plan(today,jid,array[uid1,uid2],'{}');
 if not exists(select 1 from jsonb_array_elements(rows) x where x->>'id'=first_code) then raise exception 'Save retry issued a new sticker';end if;
 begin
   perform public.app_day_plan(today,jid2,array[uid1],'{}');
   raise exception 'Duplicate daily assignment accepted';
 exception when raise_exception then if sqlerrm not like '%already on another%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',scanner::text,true);
 begin
   perform public.app_day_plan(today);
   raise exception 'Scanner can access plans';
 exception when insufficient_privilege then null;end;
 if public.app_reusable_barcode(first_code)->>'batchQuantity'<>'25' then raise exception 'Label load size did not use pack size';end if;
 begin
   perform public.app_dumping_scan(future_code,gen_random_uuid());
   raise exception 'Future label accepted';
 exception when raise_exception then if sqlerrm not like 'This label is planned for%' then raise;end if;end;
 perform public.app_dumping_scan(first_code,gen_random_uuid());
 perform public.app_dumping_scan(second_code,gen_random_uuid());
 if (select completed from public.sub_jobs where id=jid)<>50 then raise exception 'Scans did not share sub-job balance';end if;
 begin
   perform public.app_dumping_scan(second_code,gen_random_uuid(),1);
   raise exception 'Completed sub-job accepted extra pieces';
 exception when raise_exception then
   if sqlerrm not like 'Batch exceeds%' and sqlerrm not like 'Too soon%' then raise;end if;
 end;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 rows:=public.app_day_plan(today,jid2,array[uid1],'{}');
 if not exists(select 1 from jsonb_array_elements(rows) x where x->>'personId'=uid1 and x->>'jobId'=jid2) then raise exception 'Finished job did not free individual';end if;
end$$;
rollback;
