begin;
do $$
declare
 actor uuid;
 prefix text:='TEST-PLAN-DELETE-'||gen_random_uuid()::text;
 oid text:=prefix||'-ORDER';
 wid text:=prefix||'-WORK';
 jid text:=prefix||'-JOB';
 uid1 text:=prefix||'-PERSON-1';
 uid2 text:=prefix||'-PERSON-2';
 uid3 text:=prefix||'-PERSON-3';
 scanned_plan uuid:=gen_random_uuid();
 unscanned_plan uuid:=gen_random_uuid();
 work_date date:=(now() at time zone 'America/Chicago')::date;
 rows jsonb;
 ids text[];
 scanned_label text;
 unscanned_label text;
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.people(id,name,kind) values(uid1,'Deletion fixture A','individual'),
   (uid2,'Deletion fixture B','individual'),(uid3,'Deletion fixture C','individual');
 insert into public.orders(id,customer_id,stage,data)
 values(oid,(select id from public.customers limit 1),1,'{"title":"Rollback deletion test"}');
 insert into public.work_orders(id,order_id,quantity,pieces_per_pack) values(wid,oid,200,25);
 insert into public.sub_jobs(id,work_order_id,quantity,data) values(jid,wid,200,'{"name":"Deletion test"}');

 rows:=public.app_move_day_plan(work_date,jid,array[uid1,uid2],'{}',scanned_plan);
 select array_agg(x->>'id' order by x->>'id') into ids
 from jsonb_array_elements(rows) x where x->>'planId'=scanned_plan::text;
 select x->>'id' into strict scanned_label from jsonb_array_elements(rows) x
 where x->>'planId'=scanned_plan::text and x->>'personId'=uid1;
 perform public.app_approve_day_plan_group(work_date,jid,ids,scanned_plan);
 perform public.app_dumping_scan(scanned_label,gen_random_uuid());

 -- A removed member's earlier scan must still lock the whole group.
 rows:=public.app_move_day_plan(work_date,jid,array[uid2],array[uid1,uid2],scanned_plan);
 if not exists(select 1 from jsonb_array_elements(rows) x
   where x->>'planId'=scanned_plan::text and x->>'hasScans'='true') then
   raise exception 'Historical scans were not returned for the plan';
 end if;
 begin
   perform public.app_move_day_plan(work_date,jid,'{}',array[uid2],scanned_plan);
   raise exception 'A scanned plan was deleted';
 exception when raise_exception then
   if sqlerrm not like 'This plan cannot be deleted%' then raise; end if;
 end;

 rows:=public.app_move_day_plan(work_date,jid,array[uid3],'{}',unscanned_plan);
 select x->>'id' into strict unscanned_label from jsonb_array_elements(rows) x
 where x->>'planId'=unscanned_plan::text;
 perform public.app_approve_day_plan_group(work_date,jid,array[unscanned_label],unscanned_plan);
 rows:=public.app_move_day_plan(work_date,jid,'{}',array[uid3],unscanned_plan);
 if exists(select 1 from jsonb_array_elements(rows) x where x->>'planId'=unscanned_plan::text)
   or exists(select 1 from jsonb_array_elements(public.app_approved_day_plans(work_date)) x where x->>'id'=unscanned_label)
   or exists(select 1 from public.dumping_assignments where id=unscanned_label and active)
 then raise exception 'Unscanned plan was not retired'; end if;
 if (select completed from public.sub_jobs where id=jid)<>25 then
   raise exception 'Plan deletion changed the scanned piece count';
 end if;
end
$$;
rollback;
