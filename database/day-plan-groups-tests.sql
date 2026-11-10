begin;
do $$
declare
 actor uuid;
 prefix text:='TEST-PLAN-GROUPS-'||gen_random_uuid()::text;
 oid text:=prefix||'-ORDER';
 wid text:=prefix||'-WORK';
 jid text:=prefix||'-JOB';
 uid1 text:=prefix||'-PERSON-1';
 uid2 text:=prefix||'-PERSON-2';
 uid3 text:=prefix||'-PERSON-3';
 group1 uuid:=gen_random_uuid();
 group2 uuid:=gen_random_uuid();
 work_date date:=(now() at time zone 'America/Chicago')::date;
 rows jsonb;
 original_ids text[];
 first_ids text[];
 second_ids text[];
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.people(id,name,kind) values(uid1,'Group fixture A','individual'),(uid2,'Group fixture B','individual'),(uid3,'Group fixture C','individual');
 insert into public.orders(id,customer_id,stage,data)
 values(oid,(select id from public.customers limit 1),1,'{"title":"Rollback group test"}');
 insert into public.work_orders(id,order_id,quantity,pieces_per_pack) values(wid,oid,100,25);
 insert into public.sub_jobs(id,work_order_id,quantity,data) values(jid,wid,100,'{"name":"Group test"}');

 rows:=public.app_day_plan(work_date,jid,array[uid1],'{}');
 select array_agg(x->>'id' order by x->>'id') into original_ids
 from jsonb_array_elements(rows) x where x->>'jobId'=jid and x->>'planId' is null;
 perform public.app_approve_day_plan(work_date,jid,original_ids);

 rows:=public.app_move_day_plan(work_date,jid,array[uid2],'{}',group1);
 select array_agg(x->>'id' order by x->>'id') into first_ids
 from jsonb_array_elements(rows) x where x->>'planId'=group1::text;
 perform public.app_approve_day_plan_group(work_date,jid,first_ids,group1);

 rows:=public.app_move_day_plan(work_date,jid,array[uid3],'{}',group2);
 select array_agg(x->>'id' order by x->>'id') into second_ids
 from jsonb_array_elements(rows) x where x->>'planId'=group2::text;
 perform public.app_approve_day_plan_group(work_date,jid,second_ids,group2);
 if (select count(*) from jsonb_array_elements(public.app_approved_day_plans(work_date)) x where x->>'jobId'=jid)<>3 then
   raise exception 'The original and separate plans should all remain approved';
 end if;
 begin
   perform public.app_move_day_plan(work_date,jid,array[uid1,uid2],array[uid2],group1);
   raise exception 'Duplicate assignment across plans accepted';
 exception when raise_exception then
   if sqlerrm not like '%already on another%' then raise; end if;
 end;
 perform public.app_move_day_plan(work_date,jid,'{}',array[uid3],group2);
 rows:=public.app_move_day_plan(work_date,jid,array[uid2,uid3],array[uid2],group1);
 if not exists(select 1 from jsonb_array_elements(rows) x where x->>'id'=first_ids[1] and x->>'planId'=group1::text)
   or (select count(*) from jsonb_array_elements(rows) x where x->>'planId'=group1::text)<>2 then
   raise exception 'Adding a person should preserve existing labels and add one';
 end if;
 if (select array_agg(x->>'id') from jsonb_array_elements(public.app_approved_day_plans(work_date)) x where x->>'jobId'=jid)
     is distinct from original_ids then
   raise exception 'Only the unchanged plan should remain approved';
 end if;
end
$$;
rollback;
