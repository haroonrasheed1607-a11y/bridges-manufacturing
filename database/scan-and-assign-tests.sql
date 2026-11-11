begin;
do $$
declare
 admin_id uuid; scanner_id uuid;
 prefix text:='TEST-SCAN-ASSIGN-'||gen_random_uuid();
 person text:=prefix||'-PERSON';
 other_person text:=prefix||'-OTHER';
 today date:=(clock_timestamp() at time zone 'America/Chicago')::date;
 approval uuid;
 other_approval uuid;
 assigned_id text;
 qr text;
 rows jsonb;
 result jsonb;
 activation timestamptz;
 receipt uuid:=gen_random_uuid();
begin
 select id into strict admin_id from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner_id from public.staff_profiles where active and role='box_scanner' limit 1;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 insert into public.people(id,name,kind) values(person,'Rollback Scan & Assign fixture','individual'),(other_person,'Rollback busy fixture','individual');
 insert into public.orders(id,customer_id,stage,data)
 values(prefix,(select id from public.customers limit 1),1,'{"title":"Rollback scan assignment"}');
 insert into public.work_orders(id,order_id,quantity,pieces_per_pack,scan_pieces,scan_cooldown_seconds)
 values(prefix,prefix,1000,25,100,0);
 insert into public.sub_jobs(id,work_order_id,quantity) values(prefix,prefix,500),(prefix||'-J2',prefix,500);
 rows:=public.app_individual_qr_cards(array[person],true);
 qr:=rows->0->>'code';

 perform set_config('request.jwt.claim.sub',scanner_id::text,true);
 begin
   perform public.app_approve_scan_assign(today,prefix,null,true);
   raise exception 'Scanner approved a job';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 rows:=public.app_approve_scan_assign(today,prefix,null,true);
 select (row->>'id')::uuid into strict approval from jsonb_array_elements(rows) row where row->>'jobId'=prefix;
 if not rows @> jsonb_build_array(jsonb_build_object('id',approval,'piecesPerScan',100)) then raise exception 'Order scan quantity not inherited'; end if;
 rows:=public.app_approve_scan_assign(today,prefix||'-J2',50,true);
 select (row->>'id')::uuid into strict other_approval from jsonb_array_elements(rows) row where row->>'jobId'=prefix||'-J2';

 perform set_config('request.jwt.claim.sub',scanner_id::text,true);
 result:=public.app_scan_and_assign(approval,qr);
 assigned_id:=result->>'assignmentId';
 activation:=(result->>'readyAt')::timestamptz;
 if (result->>'waitSeconds')::int not between 59 and 60 then raise exception 'Assignment did not require one minute'; end if;
 if exists(select 1 from public.dumping_completions c where c.assignment_id=assigned_id)
   or (select completed from public.sub_jobs where id=prefix)<>0 then raise exception 'Assignment recorded production'; end if;
 result:=public.app_scan_and_assign(approval,qr);
 if result->>'assignmentId'<>assigned_id or (result->>'readyAt')::timestamptz is distinct from activation then
   raise exception 'Repeat assignment created a new label or reset the activation timer';
 end if;
 begin
   perform public.app_individual_job_qr(qr);
   raise exception 'Personal QR lookup bypassed activation';
 exception when raise_exception then if sqlerrm not like 'This card is assigned. Wait%' then raise; end if; end;
 begin
   perform public.app_scan_individual_job_qr(qr,assigned_id,gen_random_uuid(),100,100);
   raise exception 'Personal scan bypassed activation';
 exception when raise_exception then if sqlerrm not like 'This card is assigned. Wait%' then raise; end if; end;
 begin
   perform public.app_scan_and_assign(other_approval,qr);
   raise exception 'Individual was assigned to two jobs';
 exception when raise_exception then if sqlerrm not like 'This individual already has work%' then raise; end if; end;
 begin
   perform public.app_scan_and_assign(approval,'IND-0000000000000000');
   raise exception 'Unknown personal QR was accepted';
 exception when raise_exception then if sqlerrm not like 'Scan a system-generated%' then raise; end if; end;
 update public.dumping_assignments set scan_assign_ready_at=clock_timestamp()-interval '1 second' where id=assigned_id;
 if not public.app_individual_job_qr(qr) @> '{"batchQuantity":100,"scanQuantity":100}' then raise exception 'Incorrect active quantity'; end if;
 result:=public.app_scan_individual_job_qr(qr,assigned_id,receipt,100,100);
 if not result @> '{"pieces":100,"duplicate":false}' then raise exception 'Production failed after activation'; end if;
 if not public.app_scan_individual_job_qr(qr,assigned_id,receipt,100,100) @> '{"duplicate":true}' then raise exception 'A retry counted twice'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 begin
   perform public.app_approve_scan_assign(today,prefix,50,true);
   raise exception 'An assigned scan quantity changed';
 exception when raise_exception then if sqlerrm not like 'Pieces per scan cannot change%' then raise; end if; end;
 perform public.app_approve_scan_assign(today,prefix,null,false);
 perform set_config('request.jwt.claim.sub',scanner_id::text,true);
 begin
   perform public.app_scan_and_assign(approval,qr);
   raise exception 'Revoked approval was used';
 exception when raise_exception then if sqlerrm not like 'This Scan & Assign approval is no longer active%' then raise; end if; end;
 if (select count(*) from public.dumping_completions c where c.assignment_id=assigned_id)<>1 then raise exception 'Revocation changed recorded production'; end if;
end $$;
rollback;
