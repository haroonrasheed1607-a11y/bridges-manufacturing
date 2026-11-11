begin;
do $$
declare
 actor uuid; scanner uuid; prefix text:='TEST-SF-DASH-'||gen_random_uuid();
 qr text:='REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 day date:=date '2030-05-06';
 at_time timestamptz:=timestamp '2030-05-06 10:00' at time zone 'America/Chicago';
 rows jsonb;
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
 insert into public.people(id,name,kind) values(prefix,'Rollback Shop Floor dashboard fixture','individual');
 insert into public.orders(id,customer_id,stage,data) values
  (prefix,(select id from public.customers limit 1),1,'{"title":"Dashboard order","catalogCode":"T1"}'),
  (prefix||'-ZERO',(select id from public.customers limit 1),1,'{"title":"Zero output order"}');
 insert into public.work_orders(id,order_id,quantity,pieces_per_pack) values(prefix,prefix,1000,25),(prefix||'-ZERO',prefix||'-ZERO',1000,25);
 insert into public.sub_jobs(id,work_order_id,quantity) values(prefix,prefix,1000),(prefix||'-ZERO',prefix||'-ZERO',1000);
 insert into public.scan_assign_approvals(sub_job_id,work_date,pieces_per_scan,approved_by) values(prefix||'-ZERO',day,100,actor);
 insert into public.boxes(id,sub_job_id,person_id,quantity,completed_pieces,completed_at) values
  (prefix||'-BOX',prefix,prefix,25,25,at_time),
  (prefix||'-APPROVED',prefix,prefix,25,25,at_time);
 insert into public.production_records(box_id,completed_pieces,actor_id,completed_at)
 values(prefix||'-BOX',25,actor,at_time),(prefix||'-APPROVED',25,actor,at_time);
 insert into public.barcode_approval_batches(id,actor_id,kind,ids,reason,outcome,created_at)
 values(gen_random_uuid(),actor,'box',array[prefix||'-APPROVED'],'Rollback test','{}',at_time);
 insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,created_by) values(qr,prefix,prefix,100,actor);
 insert into public.dumping_completions(id,assignment_id,pieces,actor_id,completed_at)
 values(gen_random_uuid(),qr,100,actor,at_time),(gen_random_uuid(),qr,999,actor,at_time-interval '1 day');
 perform set_config('request.jwt.claim.sub',scanner::text,true);
 rows:=public.app_shop_floor_dashboard(day);
 if not rows @> jsonb_build_array(jsonb_build_object('id',prefix,'pieces',125,'code','T1'))
 or not rows @> jsonb_build_array(jsonb_build_object('id',prefix||'-ZERO','pieces',0)) then
  raise exception 'Order scan totals or approved zero-output orders are incorrect';
 end if;
 if (select count(*) from jsonb_array_elements(rows) row where row->>'id'=prefix)<>1 then
  raise exception 'Order was counted more than once';
 end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.app_shop_floor_dashboard(day);
  raise exception 'Anonymous dashboard access accepted';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
