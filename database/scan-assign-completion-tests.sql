begin;
do $$
declare actor uuid; scanner uuid; prefix text:='TEST-APPROVAL-COMPLETE-'||gen_random_uuid();
 item uuid:=gen_random_uuid(); r jsonb; other jsonb; rows jsonb; approval uuid; approved_at timestamptz;
 today date:=(clock_timestamp() at time zone 'America/Chicago')::date;
 qr text; assignment text; current_assignment text; revision bigint;
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.customers(id,name) values(prefix,prefix);
 insert into public.customer_items(id,customer_id,code,name,unit,pieces_per_unit) values(item,prefix,'COMPLETE-TEST','Completion test','Box',100);
 insert into public.people(id,name,kind) values(prefix||'-PERSON','Completion fixture individual','individual');
 qr:=public.app_issue_individual_job_qr(prefix||'-PERSON');
 r:=public.app_plan_create_order(prefix,item,250,today,gen_random_uuid());
 other:=public.app_plan_create_order(prefix,item,250,today,gen_random_uuid());
 approval:=(r->>'approvalId')::uuid;
 select a.approved_at into approved_at from public.scan_assign_approvals a where id=approval;
 rows:=public.app_scan_and_assign(approval,qr);assignment:=rows->>'assignmentId';
 update public.dumping_assignments set scan_assign_ready_at=clock_timestamp()-interval '1 second' where id=assignment;
 perform public.app_scan_individual_job_qr(qr,assignment,gen_random_uuid(),100,100);
 rows:=public.app_complete_scan_assign(approval,today,approved_at);
 if rows @> jsonb_build_array(jsonb_build_object('id',approval))
  or not rows @> jsonb_build_array(jsonb_build_object('id',other->>'approvalId')) then raise exception 'Wrong approvals removed';end if;
 if (select active from public.dumping_assignments where id=assignment)
  or not exists(select 1 from public.scan_assign_approvals where id=approval and completed_at is not null and completed_by=actor and revoked_at is not null) then raise exception 'Approval not completed';end if;
 if (select completed from public.sub_jobs where id=r->>'jobId')<>100
  or (select count(*) from public.dumping_completions where assignment_id=assignment)<>1 then raise exception 'Recorded production changed';end if;
 begin perform public.app_scan_and_assign(approval,qr);raise exception 'Completed approval assigned a card';exception when raise_exception then if sqlerrm not like 'This Scan & Assign approval is no longer active%' then raise;end if;end;
 begin perform public.app_individual_job_qr(qr);raise exception 'Completed assignment still scanned';exception when raise_exception then if sqlerrm not like 'This Individual Job QR has no approved%' then raise;end if;end;
 select o.revision into revision from public.orders o where id=r->>'orderId';
 perform public.app_complete_scan_assign(approval,today,approved_at);
 if (select o.revision from public.orders o where id=r->>'orderId')<>revision then raise exception 'Repeat completion changed history';end if;
 -- Explicit reapproval is possible; a stale completion cannot close the renewed approval.
 perform public.app_approve_scan_assign(today,r->>'jobId',100,true);
 if not exists(select 1 from public.scan_assign_approvals where id=approval and completed_at is null and completed_by is null and revoked_at is null) then raise exception 'Reapproval failed';end if;
 begin perform public.app_complete_scan_assign(approval,today,approved_at);raise exception 'Stale completion closed renewed approval';exception when serialization_failure then null;end;
 select a.approved_at into approved_at from public.scan_assign_approvals a where id=approval;
 rows:=public.app_scan_and_assign(approval,qr);
 rows:=public.app_scan_and_assign((other->>'approvalId')::uuid,qr);current_assignment:=rows->>'assignmentId';
 perform public.app_complete_scan_assign(approval,today,approved_at);
 if not (select active from public.dumping_assignments where id=current_assignment) then raise exception 'Completion closed another job assignment';end if;
 perform set_config('request.jwt.claim.sub',scanner::text,true);
 begin perform public.app_complete_scan_assign(approval,today,approved_at);raise exception 'Scanner marked approval complete';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.app_complete_scan_assign(uuid,date,timestamptz)','execute') then raise exception 'Anonymous completion access';end if;
end $$;
rollback;
