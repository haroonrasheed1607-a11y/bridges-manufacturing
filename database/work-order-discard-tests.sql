begin;
do $$
declare
 actor uuid;
 prefix text:='TEST-DISCARD-'||gen_random_uuid()::text;
 oid text:=prefix||'-ORDER';
 wid text:=prefix||'-WORK';
 jid text:=prefix||'-JOB';
 pid text:=prefix||'-PERSON';
 box text:='BOX-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 qr text:='REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 today date:=(now() at time zone 'America/Chicago')::date;
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.people(id,name,kind) values(pid,'Rollback discard fixture','individual');
 insert into public.orders(id,customer_id,stage,data)
 values(oid,(select id from public.customers limit 1),1,
   '{"title":"Rollback discard fixture","quantity":50,"perPack":25,"expected":"2026-11-16","workOrderApprovedAt":"2026-11-10","assignmentConfirmedAt":"2026-11-10","productionStartedAt":"2026-11-10"}');
 insert into public.work_orders(id,order_id,quantity,pieces_per_pack) values(wid,oid,50,25);
 insert into public.sub_jobs(id,work_order_id,quantity) values(jid,wid,50);
 insert into public.boxes(id,sub_job_id,person_id,quantity) values(box,jid,pid,25);
 insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,created_by,work_date)
 values(qr,jid,pid,25,actor,today);
 insert into public.bookings(id,person_id,order_id,work_order_id,starts_on,ends_on,hours)
 values(prefix||'-BOOKING',pid,oid,wid,today,today,1);

 begin
   insert into public.dumping_completions(id,assignment_id,pieces,actor_id) values(gen_random_uuid(),qr,25,actor);
   perform public.app_discard_work_order(oid,wid,1);
   raise exception 'A scanned work order was discarded';
 exception when raise_exception then
   if sqlerrm not like 'Work has been recorded%' then raise; end if;
 end;

 begin
   update public.sub_jobs set completed=1 where id=jid;
   perform public.app_discard_work_order(oid,wid,1);
   raise exception 'A work order with manual progress was discarded';
 exception when raise_exception then
   if sqlerrm not like 'Work has been recorded%' then raise; end if;
 end;

 begin
   insert into public.work_orders(id,order_id,quantity,pieces_per_pack) values(wid||'-OTHER',oid,25,25);
   insert into public.sub_jobs(id,work_order_id,quantity,completed) values(jid||'-OTHER',wid||'-OTHER',25,1);
   perform public.app_discard_work_order(oid,wid,1);
   raise exception 'Discard reopened an order with active sibling work';
 exception when raise_exception then
   if sqlerrm not like 'Other work on this order has started%' then raise; end if;
 end;

 perform public.app_discard_work_order(oid,wid,1);
 if exists(select 1 from public.work_orders where id=wid)
   or exists(select 1 from public.sub_jobs where id=jid)
   or exists(select 1 from public.boxes where id=box)
   or exists(select 1 from public.dumping_assignments where id=qr)
   or exists(select 1 from public.bookings where work_order_id=wid)
 then raise exception 'Discarded work order still has active records'; end if;
 if not exists(select 1 from public.orders where id=oid and stage=0 and revision=2
   and data->>'quantity'='50' and data->>'expected' is null and data->>'workOrderApprovedAt' is null
   and data->>'assignmentConfirmedAt' is null and data->>'productionStartedAt' is null)
 then raise exception 'Order request was not reopened correctly'; end if;
 if not exists(select 1 from public.order_events where order_id=oid and message like 'Discarded unstarted work order%')
 then raise exception 'Discard event missing'; end if;
end
$$;
rollback;
