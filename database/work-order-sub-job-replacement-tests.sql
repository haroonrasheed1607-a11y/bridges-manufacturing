begin;
do $$
declare
 actor uuid;
 customer text;
 oid text:='TEST-SPLIT-'||gen_random_uuid()::text;
 wid text:=oid||'-WORK';
 old_job text:=wid||'-OLD';
 new_job text:=wid||'-NEW';
 person text:=oid||'-PERSON';
 old_box text:=oid||'-BOX';
 reusable text:='REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 order_snapshot jsonb;
 work_snapshot jsonb;
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 select id into strict customer from public.customers limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.people(id,name,kind) values(person,'Rollback split fixture','individual');
 insert into public.orders(id,customer_id,stage,data)
 values(oid,customer,1,'{"title":"Rollback split fixture","quantity":25,"perPack":25}');
 insert into public.work_orders(id,order_id,quantity,pieces_per_pack,data)
 values(wid,oid,25,25,'{"type":"Packaging","seconds":30}');
 insert into public.sub_jobs(id,work_order_id,quantity) values(old_job,wid,25);
 insert into public.boxes(id,sub_job_id,person_id,quantity) values(old_box,old_job,person,25);
 insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,work_date,created_by)
 values(reusable,old_job,person,25,current_date,actor);

 order_snapshot:=manufacturing_private.read_order(oid);
 work_snapshot:=(order_snapshot->'workOrders'->0)||jsonb_build_object(
   'jobs',jsonb_build_array(jsonb_build_object('id',new_job,'quantity',25,'completed',0)), 'boxes','[]'::jsonb
 );
 order_snapshot:=jsonb_set(order_snapshot,'{workOrders,0}',work_snapshot);
 begin
   perform public.app_save_order(order_snapshot,(order_snapshot->>'_revision')::bigint,'Invalid fixture replacement');
   raise exception 'Replacement accepted without confirmation';
 exception when raise_exception then
   if sqlerrm not like 'Confirm sub-job replacement%' then raise; end if;
 end;

 order_snapshot:=jsonb_set(order_snapshot,'{workOrders,0,replaceSubJobs}','true');
 perform public.app_save_order(order_snapshot,(order_snapshot->>'_revision')::bigint,'Fixture replacement');
 if exists(select 1 from public.sub_jobs where id=old_job)
   or exists(select 1 from public.boxes where id=old_box)
   or exists(select 1 from public.dumping_assignments where id=reusable)
   or not exists(select 1 from public.sub_jobs where id=new_job and quantity=25)
 then raise exception 'Replacement did not retire the old labels and publish the new split'; end if;

 insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,created_by)
 values(reusable,new_job,person,25,actor);
 insert into public.dumping_completions(id,assignment_id,pieces,actor_id)
 values(gen_random_uuid(),reusable,25,actor);
 order_snapshot:=manufacturing_private.read_order(oid);
 if order_snapshot#>>'{workOrders,0,hasScans}' is distinct from 'true' then
   raise exception 'Durable scan history missing from work order';
 end if;
 order_snapshot:=jsonb_set(order_snapshot,'{workOrders,0,jobs,0,id}',to_jsonb(old_job));
 order_snapshot:=jsonb_set(order_snapshot,'{workOrders,0,replaceSubJobs}','true');
 begin
   perform public.app_save_order(order_snapshot,(order_snapshot->>'_revision')::bigint,'Invalid scanned replacement');
   raise exception 'Replacement accepted after a scan with a zero tally';
 exception when raise_exception then
   if sqlerrm not like 'Sub-jobs cannot be replaced%' then raise; end if;
 end;
end
$$;
rollback;
