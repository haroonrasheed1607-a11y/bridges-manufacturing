begin;
do $$
declare actor uuid; prefix text:='TEST-SHEET-CODE-'||gen_random_uuid(); label text:='REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)); result jsonb;
 today date:=(statement_timestamp() at time zone 'America/Chicago')::date; week date;
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 week:=today-(extract(isodow from today)::integer-1);
 insert into public.customers(id,name) values(prefix,prefix);
 insert into public.people(id,name,kind) values(prefix||'-P','Timesheet code fixture','individual');
 insert into public.orders(id,customer_id,stage,data) values(prefix,prefix,1,'{"title":"Item code fixture","catalogCode":"4015"}');
 insert into public.work_orders(id,order_id,quantity,pieces_per_pack,data) values(prefix||'-W',prefix,100,25,'{"partCode":"OLD-WORK-CODE"}');
 insert into public.sub_jobs(id,work_order_id,quantity,completed) values(prefix||'-J',prefix||'-W',100,50);
 insert into public.boxes(id,sub_job_id,person_id,quantity,completed_pieces,completed_at) values(prefix||'-B',prefix||'-J',prefix||'-P',25,25,now());
 insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,created_by) values(label,prefix||'-J',prefix||'-P',25,actor);
 insert into public.dumping_completions(id,assignment_id,pieces,actor_id) values(gen_random_uuid(),label,25,actor);
 result:=public.app_individual_timesheet(prefix||'-P',week);
 if jsonb_array_length(result->'entries')<>2
  or exists(select 1 from jsonb_array_elements(result->'entries') e where e->>'itemCode'<>'4015' or e->>'code'<>'OLD-WORK-CODE')
  or (select sum((e->>'pieces')::int) from jsonb_array_elements(result->'entries') e)<>50 then
  raise exception 'Timesheet item codes or counts are incorrect';
 end if;
end $$;
rollback;
