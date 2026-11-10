begin;
do $$
declare
 actor uuid;
 scanner uuid;
 prefix text:='TEST-PLAN-APPROVAL-'||gen_random_uuid()::text;
 oid text:=prefix||'-ORDER';
 wid text:=prefix||'-WORK';
 jid text:=prefix||'-JOB';
 uid1 text:=prefix||'-PERSON-1';
 uid2 text:=prefix||'-PERSON-2';
 work_date date:=(now() at time zone 'America/Chicago')::date;
 rows jsonb;
 label_ids text[];
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
 insert into public.people(id,name,kind) values(uid1,'Approval fixture A','individual'),(uid2,'Approval fixture B','individual');
 insert into public.orders(id,customer_id,stage,data)
 values(oid,(select id from public.customers limit 1),1,'{"title":"Rollback approval test"}');
 insert into public.work_orders(id,order_id,quantity,pieces_per_pack) values(wid,oid,100,25);
 insert into public.sub_jobs(id,work_order_id,quantity,data) values(jid,wid,100,'{"name":"Approval test"}');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 rows:=public.app_day_plan(work_date,jid,array[uid1],'{}');
 select array_agg(x->>'id' order by x->>'id') into label_ids from jsonb_array_elements(rows) x where x->>'jobId'=jid;
 if cardinality(label_ids) is distinct from 1 then raise exception 'Move did not save the selected individual'; end if;
 if exists(select 1 from jsonb_array_elements(public.app_approved_day_plans(work_date)) x where x->>'jobId'=jid) then
   raise exception 'Draft plan appeared in Print';
 end if;
 perform public.app_approve_day_plan(work_date,jid,label_ids);
 perform public.app_approve_day_plan(work_date,jid,label_ids);
 if not exists(select 1 from jsonb_array_elements(public.app_approved_day_plans(work_date)) x where x->>'jobId'=jid and x->>'approvedAt' is not null) then
   raise exception 'Approved plan missing from Print';
 end if;
 perform public.app_day_plan(work_date,jid,array[uid1,uid2],array[uid1]);
 if exists(select 1 from jsonb_array_elements(public.app_approved_day_plans(work_date)) x where x->>'jobId'=jid) then
   raise exception 'Editing plan did not revoke approval';
 end if;
 begin
   perform public.app_approve_day_plan(work_date,jid,label_ids);
   raise exception 'Stale approval succeeded';
 exception when serialization_failure then null;
 end;
 perform set_config('request.jwt.claim.sub',scanner::text,true);
 begin
   perform public.app_approved_day_plans(work_date);
   raise exception 'Scanner-only account accessed Print';
 exception when insufficient_privilege then null;
 end;
end;
$$;
rollback;
