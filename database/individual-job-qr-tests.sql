begin;
do $$
declare
 actor uuid;
 scanner uuid;
 prefix text:='TEST-JOB-QR-'||gen_random_uuid()::text;
 oid text:=prefix||'-ORDER';
 wid text:=prefix||'-WORK';
 j1 text:=prefix||'-JOB-1';
 j2 text:=prefix||'-JOB-2';
 pid text:=prefix||'-PERSON';
 d date:=(now() at time zone 'America/Chicago')::date;
 code text;
 first_label text;
 second_label text;
 request_id uuid:=gen_random_uuid();
 rows jsonb;
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.people(id,name,kind) values(pid,'Rollback Job QR fixture','individual');
 insert into public.orders(id,customer_id,stage,data)
 values(oid,(select id from public.customers limit 1),1,'{"title":"Rollback Job QR order"}');
 insert into public.work_orders(id,order_id,quantity,pieces_per_pack,scan_pieces)
 values(wid,oid,400,25,100);
 insert into public.sub_jobs(id,work_order_id,quantity,data)
 values(j1,wid,200,'{"name":"First job"}'),(j2,wid,200,'{"name":"Second job"}');

 code:=public.app_issue_individual_job_qr(pid);
 if code !~ '^IND-[A-F0-9]{16}$' or public.app_issue_individual_job_qr(pid) is distinct from code then
   raise exception 'Personal QR changed on reissue';
 end if;
 rows:=public.app_day_plan(d,j1,array[pid],'{}');
 select x->>'id' into strict first_label from jsonb_array_elements(rows) x where x->>'personId'=pid;
 begin
   perform public.app_individual_job_qr(code);
   raise exception 'Unapproved plan could be scanned';
 exception when raise_exception then
   if sqlerrm not like 'This Individual Job QR has no approved%' then raise; end if;
 end;
 perform public.app_approve_day_plan(d,j1,array[first_label]);
 perform set_config('request.jwt.claim.sub',scanner::text,true);
 if public.app_individual_job_qr(code)->>'batchQuantity' is distinct from '100' then
   raise exception 'Personal QR did not use the configured scan quantity';
 end if;
 perform public.app_scan_individual_job_qr(code,first_label,request_id,100,100);
 if (select completed from public.sub_jobs where id=j1)<>100 then
   raise exception 'Scan did not credit the first job';
 end if;

 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform public.app_release_job_qr_assignment(first_label,d);
 rows:=public.app_day_plan(d,j2,array[pid],'{}');
 select x->>'id' into strict second_label from jsonb_array_elements(rows) x where x->>'personId'=pid;
 perform public.app_approve_day_plan(d,j2,array[second_label]);

 perform set_config('request.jwt.claim.sub',scanner::text,true);
 if public.app_individual_job_qr(code)->>'id' is distinct from second_label then
   raise exception 'The same QR did not resolve to the reassigned job';
 end if;
 if public.app_scan_individual_job_qr(code,first_label,request_id,100,100)->>'duplicate' is distinct from 'true' then
   raise exception 'Retry after reassignment did not return the original receipt';
 end if;
 begin
   perform public.app_scan_individual_job_qr(code,first_label,gen_random_uuid(),100,100);
   raise exception 'Stale job confirmation was accepted';
 exception when serialization_failure then null;
 end;
 perform public.app_scan_individual_job_qr(code,second_label,gen_random_uuid(),100,100);
 if (select completed from public.sub_jobs where id=j1)<>100
   or (select completed from public.sub_jobs where id=j2)<>100
 then raise exception 'Reassignment changed the old output or credited the wrong job'; end if;
end
$$;
rollback;
