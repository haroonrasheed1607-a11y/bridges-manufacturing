-- Roll back every fixture and audit record.
begin;
do $$
declare actor uuid; pid text; wid text:='TEST-IND-WORK'; oid text:='TEST-IND-ORDER'; label text:='Test individual '||gen_random_uuid();
 rows jsonb; schedule jsonb:='[4,0,3,0,0,2,0]';
begin
 select id into actor from public.staff_profiles where role='admin' and active limit 1;
 if actor is null then raise exception 'An active admin is required';end if;
 begin
   perform public.app_import_individuals(jsonb_build_array(jsonb_build_object('name',label)));
   raise exception 'Unauthorized import accepted';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 rows:=jsonb_build_array(jsonb_build_object('name',label,'role','Assembly'));
 perform public.app_import_individuals(rows);
 select id into strict pid from public.people where name=label;
 if (select hours_per_day from public.people where id=pid)<>6 then raise exception 'Default hours missing';end if;
 begin
   perform public.app_import_individuals(rows);
   raise exception 'Duplicate import accepted';
 exception when raise_exception then if sqlerrm not like '%already exists%' then raise;end if;end;
 perform public.app_save_person(jsonb_build_object('id',pid,'name',label,'kind','individual','hoursPerDay',6,'weeklyHours',schedule));
 perform public.app_set_individual_active(pid,false);
 perform public.app_import_individuals(jsonb_build_array(jsonb_build_object('name',upper(label),'existingId',pid,'role','Packing')));
 if not exists(select 1 from public.people where id=pid and data->'weeklyHours'=schedule and data->>'active'='false' and data->>'role'='Packing') then
   raise exception 'Confirmed import lost weekly hours or status';
 end if;
 insert into public.orders(id,customer_id,stage,data) values(oid,(select id from public.customers limit 1),1,'{"title":"Rollback test"}');
 insert into public.work_orders(id,order_id,quantity,pieces_per_pack) values(wid,oid,10,1);
 rows:=jsonb_build_object('id','TEST-IND-BOOK','orderId',oid,'workId',wid,'personId',pid,'start','2026-11-14','end','2026-11-15','hours',2);
 begin
   perform public.app_save_booking(rows);
   raise exception 'Disabled person accepted for booking';
 exception when raise_exception then if sqlerrm<>'Select an active individual' then raise;end if;end;
 perform public.app_set_individual_active(pid,true);
 perform public.app_save_booking(rows);
 if not exists(select 1 from public.bookings where id='TEST-IND-BOOK' and data->'allocatedDates'='["2026-11-14"]') then
   raise exception 'Saturday hours were not used';
 end if;
end$$;
rollback;
