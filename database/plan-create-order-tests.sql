begin;
do $$
declare
 actor uuid; scanner uuid; coach1 uuid:=gen_random_uuid(); coach2 uuid:=gen_random_uuid();
 prefix text:='TEST-QUICK-PLAN-'||gen_random_uuid(); cid text:=prefix||'-CLIENT';
 item uuid:=gen_random_uuid(); request uuid:=gen_random_uuid(); r jsonb; again jsonb; details jsonb; qr text;
 oid text; wid text; jid text; aid uuid; assignment text;
 today date:=(clock_timestamp() at time zone 'America/Chicago')::date;
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
 insert into public.people(id,name,kind,data) values(prefix||'-C1','Test coach one','coach','{}'),
  (prefix||'-C2','Test coach two','coach','{}'),(prefix||'-DISABLED','Disabled coach','coach','{"active":false}'),
  (prefix||'-PERSON','Test plan individual','individual','{}');
 insert into auth.users(id,email) values(coach1,coach1::text||'@example.invalid'),(coach2,coach2::text||'@example.invalid');
 insert into public.staff_profiles(id,role,display_name,person_id) values(coach1,'coach','Coach one',prefix||'-C1'),(coach2,'coach','Coach two',prefix||'-C2');
 insert into public.customers(id,name) values(cid,prefix);
 insert into public.customer_items(id,customer_id,code,name,rate,unit,pieces_per_unit,production_defaults)
 values(item,cid,'PART-TEST','Quick plan item',0.125,'Box',100,'{"perPack":100,"type":"Packaging","description":"Pack the parts","instructions":"Check the sample first"}');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 r:=public.app_plan_create_order(cid,item,250,today,request);
 oid:=r->>'orderId';wid:=r->>'workId';jid:=r->>'jobId';aid:=(r->>'approvalId')::uuid;
 if not r @> '{"quantity":250,"piecesPerScan":100,"duplicate":false}' or r->>'required'<>today::text then raise exception 'Wrong receipt %',r;end if;
 if (select stage from public.orders where id=oid)<>1
  or (select count(*) from public.work_orders where order_id=oid)<>1
  or (select count(*) from public.sub_jobs where work_order_id=wid)<>1
  or (select quantity from public.sub_jobs where id=jid)<>250 then raise exception 'Order did not reach production with one sub-job';end if;
 if (select count(*) from public.work_order_coaches where work_order_id=wid)<>(select count(*) from public.people where kind='coach' and data->>'active' is distinct from 'false')
  or exists(select 1 from public.work_order_coaches where work_order_id=wid and person_id=prefix||'-DISABLED') then raise exception 'Coach assignment mismatch';end if;
 if not exists(select 1 from public.work_orders where id=wid and scan_cooldown_seconds=120 and scan_pieces=100
  and data @> jsonb_build_object('instructions','Check the sample first','description','Pack the parts','type','Packaging','seconds',30,'hoursPerDay',6,'required',today,'startDate',today)) then raise exception 'Defaults missing';end if;
 if not exists(select 1 from public.orders where id=oid and data->>'title'='Quick plan item' and (data->>'catalogRate')::numeric=0.125
  and data->>'workOrderApprovedAt' is not null and data->>'assignmentConfirmedAt' is not null) then raise exception 'Order approval/catalog snapshot missing';end if;
 if not exists(select 1 from public.scan_assign_approvals where id=aid and sub_job_id=jid and work_date=today and revoked_at is null) then raise exception 'Not scan-ready';end if;
 again:=public.app_plan_create_order(cid,item,250,today,request);
 if again->>'orderId'<>oid or not again @> '{"duplicate":true}'
  or (select count(*) from public.orders where customer_id=cid)<>1 then raise exception 'Retry created duplicates';end if;
 begin perform public.app_plan_create_order(cid,item,251,today,request);raise exception 'Changed retry accepted';exception when raise_exception then if sqlerrm<>'This plan request reference has already been used' then raise;end if;end;
 begin perform public.app_plan_create_order(cid,item,0,today,gen_random_uuid());raise exception 'Zero accepted';exception when raise_exception then if sqlerrm not like 'Select a client%' then raise;end if;end;
 begin perform public.app_plan_create_order(cid||'-WRONG',item,250,today,gen_random_uuid());raise exception 'Mismatched client accepted';exception when raise_exception then if sqlerrm<>'Select an item registered for this client' then raise;end if;end;
 begin perform public.app_plan_create_order(cid,item,250,today-1,gen_random_uuid());raise exception 'Previous day accepted';exception when serialization_failure then null;end;
 if (select count(*) from public.orders where customer_id=cid)<>1 then raise exception 'Validation failure created partial order';end if;
 -- Partial final packs use the remaining quantity rather than exceeding the order.
 again:=public.app_plan_create_order(cid,item,7,today,gen_random_uuid());
 if not again @> '{"piecesPerScan":7}' then raise exception 'Small order scan quantity failed';end if;
 qr:=public.app_issue_individual_job_qr(prefix||'-PERSON');
 perform set_config('request.jwt.claim.sub',coach1::text,true);
 if not manufacturing_private.can_read_order(oid) then raise exception 'First coach cannot access shared order';end if;
 details:=public.app_get_workspace();
 if not exists(select 1 from jsonb_array_elements(details->'orders') o where o->>'id'=oid and jsonb_array_length(o->'workOrders')=1 and not(o ? 'catalogRate')) then raise exception 'Shared work missing or rate leaked';end if;
 if not public.app_scan_assign_approvals(today) @> jsonb_build_array(jsonb_build_object('id',aid)) then raise exception 'Shared approval missing for coach';end if;
 r:=public.app_scan_and_assign(aid,qr);assignment:=r->>'assignmentId';
 update public.dumping_assignments set scan_assign_ready_at=clock_timestamp()-interval '1 second' where id=assignment;
 perform set_config('request.jwt.claim.sub',coach2::text,true);
 if not manufacturing_private.can_read_order(oid) then raise exception 'Second coach cannot access shared order';end if;
 r:=public.app_scan_individual_job_qr(qr,assignment,gen_random_uuid(),100,100);
 if not r @> '{"pieces":100,"duplicate":false}' or (select completed from public.sub_jobs where id=jid)<>100 then raise exception 'Shared-coach scan failed %',r;end if;
 begin perform public.app_plan_create_order(cid,item,250,today,gen_random_uuid());raise exception 'Coach created order';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',scanner::text,true);
 begin perform public.app_plan_create_order(cid,item,250,today,gen_random_uuid());raise exception 'Scanner created order';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.app_plan_create_order(text,uuid,integer,date,uuid)','execute')
  or has_table_privilege('authenticated','public.work_order_coaches','select')
  or has_table_privilege('authenticated','public.plan_order_requests','select') then raise exception 'Planning API exposed';end if;
 -- Shared access never grants a coach permission to an unrelated legacy work order.
 insert into public.orders(id,customer_id,stage,data) values(prefix||'-PRIVATE',cid,1,'{}');
 insert into public.work_orders(id,order_id,coach_id,quantity,pieces_per_pack) values(prefix||'-PRIVATE-W',prefix||'-PRIVATE',prefix||'-C1',10,10);
 perform set_config('request.jwt.claim.sub',coach2::text,true);
 if manufacturing_private.can_read_order(prefix||'-PRIVATE') then raise exception 'Unassigned legacy order exposed';end if;
end $$;
rollback;
