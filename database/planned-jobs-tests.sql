begin;
do $$
declare actor uuid; scanner uuid; prefix text:='TEST-PLANNED-JOBS-'||gen_random_uuid(); item uuid:=gen_random_uuid();
 assignment text:='REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)); r jsonb; rows jsonb;
 today date:=(clock_timestamp() at time zone 'America/Chicago')::date; approved timestamptz;
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.customers(id,name) values(prefix,prefix);
 insert into public.customer_items(id,customer_id,code,name,unit,pieces_per_unit) values(item,prefix,'PLANNED-TEST','Planned test','Box',100);
 insert into public.people(id,name,kind) values(prefix||'-P','Planned fixture individual','individual');
 r:=public.app_plan_create_order(prefix,item,250,today,gen_random_uuid());
 insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,work_date,created_by)
 values(assignment,r->>'jobId',prefix||'-P',100,today,actor);
 insert into public.dumping_completions(id,assignment_id,pieces,actor_id) values(gen_random_uuid(),assignment,100,actor);
 update public.sub_jobs set completed=100 where id=r->>'jobId';
 select row into rows from jsonb_array_elements(public.app_planned_jobs(today)) row where row->>'jobId'=r->>'jobId';
 if not rows @> '{"quantity":250,"completed":100,"piecesToday":100,"status":"Ready for production","canComplete":true}' then raise exception 'Wrong planned job totals %',rows;end if;
 if (select count(*) from jsonb_array_elements(public.app_planned_jobs(today)) row where row->>'jobId'=r->>'jobId')<>1 then raise exception 'Approval and assignment duplicated the row';end if;
 if exists(select 1 from jsonb_array_elements(public.app_planned_jobs(today-1)) row where row->>'jobId'=r->>'jobId') then raise exception 'Wrong-date job shown';end if;
 select a.approved_at into approved from public.scan_assign_approvals a where id=(r->>'approvalId')::uuid;
 perform public.app_complete_scan_assign((r->>'approvalId')::uuid,today,approved);
 select row into rows from jsonb_array_elements(public.app_planned_jobs(today)) row where row->>'jobId'=r->>'jobId';
 if not rows @> '{"status":"Completed","canComplete":false,"piecesToday":100,"completed":100}' then raise exception 'Completed job missing or totals changed %',rows;end if;
 update public.dumping_assignments set active=true,work_date=today+1 where id=assignment;
 select row into rows from jsonb_array_elements(public.app_planned_jobs(today+1)) row where row->>'jobId'=r->>'jobId';
 if not rows @> '{"status":"Planned","piecesToday":0}' then raise exception 'Manual future plan missing %',rows;end if;
 perform set_config('request.jwt.claim.sub',scanner::text,true);
 begin perform public.app_planned_jobs(today);raise exception 'Scanner accessed planning list';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.app_planned_jobs(date)','execute') then raise exception 'Public planning list';end if;
end $$;
rollback;
