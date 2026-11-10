begin;
do $$
declare
 actor uuid;
 scanner uuid;
 prefix text:='TEST-DASHBOARD-'||gen_random_uuid()::text;
 oid text:=prefix||'-ORDER';
 wid text:=prefix||'-WORK';
 jid text:=prefix||'-JOB';
 a text:=prefix||'-A';
 b text:=prefix||'-B';
 reusable_a text:='REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 reusable_b text:='REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 box_scan text:='BOX-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 box_approved text:='BOX-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 d date:=(now() at time zone 'America/Chicago')::date;
 day_start timestamptz:=d::timestamp at time zone 'America/Chicago';
 fixture_before jsonb;
 result jsonb;
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 fixture_before:=public.app_dashboard_production(d,1);
 insert into public.people(id,name,kind) values(a,'Dashboard fixture A','individual'),(b,'Dashboard fixture B','individual');
 insert into public.orders(id,customer_id,stage,data)
 values(oid,(select id from public.customers limit 1),1,'{"title":"Rollback dashboard test"}');
 insert into public.work_orders(id,order_id,quantity,pieces_per_pack) values(wid,oid,300,25);
 insert into public.sub_jobs(id,work_order_id,quantity) values(jid,wid,300);
 insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,created_by)
 values(reusable_a,jid,a,100,actor),(reusable_b,jid,b,50,actor);
 insert into public.dumping_completions(id,assignment_id,pieces,actor_id,completed_at)
 values(gen_random_uuid(),reusable_a,100,actor,day_start),
       (gen_random_uuid(),reusable_b,50,actor,day_start-interval '1 second');
 insert into public.boxes(id,sub_job_id,person_id,quantity,completed_pieces,completed_at)
 values(box_scan,jid,b,25,25,day_start+interval '1 hour'),
       (box_approved,jid,b,75,75,day_start+interval '2 hours');
 insert into public.production_records(box_id,completed_pieces,actor_id,completed_at)
 values(box_scan,25,actor,day_start+interval '1 hour'),
       (box_approved,75,actor,day_start+interval '2 hours');
 insert into public.barcode_approval_batches(id,actor_id,kind,ids,reason,outcome,created_at)
 values(gen_random_uuid(),actor,'box',array[box_approved],'Rollback dashboard fixture','{}',day_start+interval '2 hours');

 result:=public.app_dashboard_production(d,1);
 if (result->>'pieces')::bigint-(fixture_before->>'pieces')::bigint<>125
   or (result->>'scans')::bigint-(fixture_before->>'scans')::bigint<>2
   or (result->>'individuals')::bigint-(fixture_before->>'individuals')::bigint<>2
   or (result->>'approvedPieces')::bigint-(fixture_before->>'approvedPieces')::bigint<>75
   or jsonb_array_length(result->'daily')<>7
 then raise exception 'Dashboard did not separate QR output from approvals or use Tulsa dates'; end if;
 if (result#>>'{daily,5,pieces}')::bigint-(fixture_before#>>'{daily,5,pieces}')::bigint<>50
   or (result#>>'{daily,6,pieces}')::bigint-(fixture_before#>>'{daily,6,pieces}')::bigint<>125
 then raise exception 'Dashboard trend has incorrect totals'; end if;
 result:=public.app_dashboard_production(d,7);
 if not exists(select 1 from jsonb_array_elements(result->'performers') p where p->>'id'=a)
   and (select min((p->>'pieces')::bigint) from jsonb_array_elements(result->'performers') p)<100
 then raise exception 'Top performers omitted a higher performer'; end if;

 perform set_config('request.jwt.claim.sub',scanner::text,true);
 begin
   perform public.app_dashboard_production(d,1);
   raise exception 'Scanner accessed the management dashboard';
 exception when insufficient_privilege then null;
 end;
end
$$;
rollback;
