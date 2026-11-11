begin;
do $$
declare
 actor uuid; scanner uuid; prefix text:='TEST-DAILY-'||upper(gen_random_uuid()::text);
 person text:=prefix||'-P'; job text:=prefix||'-J'; job2 text:=prefix||'-J2'; qr text; target text;
 a text:='REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 a2 text:='REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 b text:='BOX-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
 today date:=(statement_timestamp() at time zone 'America/Chicago')::date;
 request uuid:=gen_random_uuid(); r jsonb; rows jsonb;
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.people(id,name,kind) values(person,'Rollback daily total fixture','individual');
 qr:=public.app_issue_individual_job_qr(person);
 insert into public.orders(id,customer_id,stage,data) values(prefix,(select id from public.customers limit 1),1,'{"title":"Daily total test"}');
 insert into public.work_orders(id,order_id,quantity,pieces_per_pack) values(prefix||'-W',prefix,1100,100);
 insert into public.sub_jobs(id,work_order_id,quantity,completed) values(job,prefix||'-W',1000,100),(job2,prefix||'-W',100,0);
 insert into public.dumping_assignments(id,person_id,sub_job_id,batch_quantity,created_by,work_date,plan_approved_at,active)
 values(a,person,job,100,actor,today,now(),true),(a2,person,job2,100,actor,today,now(),false);
 insert into public.dumping_completions(id,assignment_id,pieces,actor_id) values(gen_random_uuid(),a,100,actor);
 insert into public.boxes(id,person_id,sub_job_id,quantity) values(b,person,job,50);
 r:=public.app_admin_qr_daily_summary(a)->0;
 if not r @> '{"recorded":100,"maxTotal":950}' then raise exception 'Wrong initial daily total/reservation %',r; end if;
 r:=public.app_set_qr_daily_total(a,a,today,300,100,request);
 if not r @> '{"total":300,"added":200,"duplicate":false}' then raise exception 'Wrong delta %',r; end if;
 r:=public.app_set_qr_daily_total(a,a,today,300,100,request);
 if not r @> '{"duplicate":true,"added":200}' then raise exception 'Retry failed %',r; end if;
 if (select completed from public.sub_jobs where id=job)<>300 then raise exception 'Retry double counted'; end if;
 r:=public.app_set_qr_daily_total(a,a,today,300,300,gen_random_uuid());
 if not r @> '{"added":0}' then raise exception 'Unchanged total counted'; end if;
 begin perform public.app_set_qr_daily_total(a,a,today,400,100,gen_random_uuid());raise exception 'Accepted stale total';exception when serialization_failure then null;end;
 begin perform public.app_set_qr_daily_total(a,a,today,100,300,gen_random_uuid());raise exception 'Accepted lower total';exception when raise_exception then if sqlerrm not like 'Enter a total from%' then raise;end if;end;
 begin perform public.app_set_qr_daily_total(a,a,today,951,300,gen_random_uuid());raise exception 'Accepted reserved production';exception when raise_exception then if sqlerrm not like 'Enter a total from%' then raise;end if;end;
 begin perform public.app_set_qr_daily_total(a,a,today-1,400,300,gen_random_uuid());raise exception 'Accepted previous day';exception when serialization_failure then null;end;
 rows:=public.app_admin_qr_daily_summary(qr);
 if jsonb_array_length(rows)<>2 then raise exception 'Missing personal card job selection %',rows;end if;
 select row->>'id' into target from jsonb_array_elements(rows) row where row->>'jobId'=job;
 r:=public.app_set_qr_daily_total(qr,target,today,350,300,gen_random_uuid());
 if not r @> '{"added":50}' then raise exception 'Personal card delta failed %',r;end if;
 r:=public.app_set_qr_daily_total(b,b,today,20,0,gen_random_uuid());
 if not r @> '{"added":20}' then raise exception 'Single use total failed %',r;end if;
 r:=public.app_set_qr_daily_total(b,b,today,40,20,gen_random_uuid());
 if not r @> '{"added":20}' or (select completed from public.sub_jobs where id=job)<>390
  or (select completed_pieces from public.production_records where box_id=b)<>40
  or (select count(*) from public.production_records where box_id=b)<>1 then raise exception 'Box partial delta failed %',r;end if;
 if (select sum(pieces) from public.dumping_completions where assignment_id=a)<>350 then raise exception 'Report total mismatch';end if;
 if (select count(*) from public.admin_qr_daily_totals where actor_id=actor and target_id in(a,b))<>5 then raise exception 'Missing audit receipts';end if;
 perform set_config('request.jwt.claim.sub',scanner::text,true);
 begin perform public.app_admin_qr_daily_summary(qr);raise exception 'Scanner read admin form';exception when insufficient_privilege then null;end;
 begin perform public.app_set_qr_daily_total(a,a,today,500,350,gen_random_uuid());raise exception 'Scanner set total';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.app_set_qr_daily_total(text,text,date,integer,integer,uuid)','execute')
 or has_table_privilege('authenticated','public.admin_qr_daily_totals','select') then raise exception 'Audit API exposed';end if;
end $$;
rollback;
