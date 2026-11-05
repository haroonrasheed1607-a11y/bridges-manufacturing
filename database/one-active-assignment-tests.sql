begin;
do $$declare uid uuid;oid text:='TEST-SINGLE-ORDER';wid text:='TEST-SINGLE-WORK';jid text:='TEST-SINGLE-JOB';pid text:='TEST-SINGLE-PERSON';box jsonb;result jsonb;begin
 select id into uid from public.staff_profiles where role='admin' and active limit 1;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 insert into public.people(id,name,kind,hours_per_day,data) values(pid,'Single assignment rollback','individual',6,'{}');
 insert into public.orders(id,customer_id,stage,data) values(oid,(select id from public.customers limit 1),1,'{"title":"Single test","quantity":200,"perPack":25}');
 insert into public.work_orders(id,order_id,quantity,pieces_per_pack,data) values(wid,oid,200,25,'{"type":"Assembly","seconds":30}');
 insert into public.sub_jobs(id,work_order_id,quantity,data) values(jid,wid,200,'{"name":"Test job"}');
 box:=jsonb_build_object('id','TEST-SINGLE-BOX1','jobId',jid,'personId',pid,'quantity',25,'date','2099-01-05');
 perform public.app_create_box(oid,wid,box);
 result:=public.app_person_current_work(pid);
 if not (result->>'busy')::boolean or result#>>'{items,0,id}'<>'TEST-SINGLE-BOX1' then raise exception 'Current barcode lookup failed';end if;
 begin perform public.app_create_box(oid,wid,box||'{"id":"TEST-SINGLE-BOX2"}');raise exception 'Second box accepted';exception when raise_exception then if sqlerrm not like 'This individual already has work%' then raise;end if;end;
 begin perform public.app_dumping_assign('DUMP-ABCDEF0123456789',jid,pid,100);raise exception 'Dumping accepted while box open';exception when raise_exception then if sqlerrm not like 'This individual already has work%' then raise;end if;end;
 perform public.app_complete_box('TEST-SINGLE-BOX1',25);
 result:=public.app_person_current_work(pid);if (result->>'busy')::boolean then raise exception 'Completion did not release person';end if;
 perform public.app_dumping_assign('DUMP-ABCDEF0123456789',jid,pid,100);
 begin perform public.app_create_box(oid,wid,box||'{"id":"TEST-SINGLE-BOX2"}');raise exception 'Box accepted during dumping';exception when raise_exception then if sqlerrm not like 'This individual already has work%' then raise;end if;end;
 -- Same assignment retry remains idempotent.
 perform public.app_dumping_assign('DUMP-ABCDEF0123456789',jid,pid,100);
 perform public.app_dumping_close('DUMP-ABCDEF0123456789');
 perform public.app_create_box(oid,wid,box||'{"id":"TEST-SINGLE-BOX2"}');
 if (select count(*) from public.boxes where person_id=pid and completed_at is null)<>1 then raise exception 'Unexpected active assignment count';end if;
 perform set_config('request.jwt.claim.sub',(select id::text from public.staff_profiles where role='box_scanner' limit 1),true);
 begin perform public.app_person_current_work(pid);raise exception 'Scanner accessed setup lookup';exception when insufficient_privilege then null;end;
end$$;
rollback;
