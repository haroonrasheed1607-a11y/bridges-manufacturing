alter table public.people add column if not exists job_qr_code text
 check(job_qr_code ~ '^IND-[A-F0-9]{16}$');
create unique index if not exists people_job_qr_code_idx on public.people(job_qr_code) where job_qr_code is not null;

create or replace function manufacturing_private.issue_individual_job_qr(p_person text)
returns text language plpgsql security definer set search_path='' as $$
declare code text;
begin
 perform manufacturing_private.require_manager();
 update public.people set job_qr_code=coalesce(job_qr_code,'IND-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)))
 where id=p_person and kind='individual' and data->>'active' is distinct from 'false'
 returning job_qr_code into code;
 if code is null then raise exception 'Select an active individual'; end if;
 return code;
end;
$$;

create or replace function manufacturing_private.resolve_individual_job_qr(p_code text)
returns public.dumping_assignments language plpgsql stable set search_path='' as $$
declare assignment public.dumping_assignments;
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('admin','manager','coach','station','box_scanner') then
   raise exception 'Scanner access required' using errcode='42501';
 end if;
 select a.* into assignment from public.people p join public.dumping_assignments a on a.person_id=p.id
 join public.sub_jobs j on j.id=a.sub_job_id join public.work_orders w on w.id=j.work_order_id
 join public.orders o on o.id=w.order_id
 where p.job_qr_code=upper(trim(p_code)) and p.kind='individual' and p.data->>'active' is distinct from 'false'
   and a.active and a.plan_approved_at is not null and a.work_date=(now() at time zone 'America/Chicago')::date
   and o.stage=1 and j.completed<j.quantity;
 if assignment.id is null then raise exception 'This Individual Job QR has no approved, unfinished plan for today.'; end if;
 perform manufacturing_private.dumping_access(assignment.sub_job_id,false);
 return assignment;
end;
$$;

create or replace function manufacturing_private.individual_job_qr(p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare assignment public.dumping_assignments; details jsonb;
begin
 assignment:=manufacturing_private.resolve_individual_job_qr(p_code);
 select jsonb_build_object('orderTitle',o.data->>'title','jobName',j.data->>'name','orderId',o.id)
 into details from public.sub_jobs j join public.work_orders w on w.id=j.work_order_id
 join public.orders o on o.id=w.order_id where j.id=assignment.sub_job_id;
 return manufacturing_private.reusable_barcode(assignment.id)||details;
end;
$$;

create or replace function manufacturing_private.scan_individual_job_qr(
 p_code text,p_assignment text,p_request uuid,p_pieces integer,p_expected_load integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare oid text; assignment public.dumping_assignments; receipt public.dumping_completions;
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('admin','manager','coach','station','box_scanner') then
   raise exception 'Scanner access required' using errcode='42501';
 end if;
 -- Lock the order behind the displayed assignment before rechecking the plan.
 select w.order_id into oid from public.dumping_assignments a
 join public.people p on p.id=a.person_id join public.sub_jobs j on j.id=a.sub_job_id
 join public.work_orders w on w.id=j.work_order_id
 where a.id=p_assignment and p.job_qr_code=upper(trim(p_code));
 perform 1 from public.orders where id=oid for update;

 -- A retry must return the original receipt even after the individual moves to another job.
 select c.* into receipt from public.dumping_completions c
 join public.dumping_assignments a on a.id=c.assignment_id join public.people p on p.id=a.person_id
 where c.id=p_request and c.actor_id=auth.uid() and a.id=p_assignment and p.job_qr_code=upper(trim(p_code));
 if receipt.id is not null then
   return jsonb_build_object('duplicate',true,'pieces',receipt.pieces,'eventId',receipt.id,'personId',
     (select person_id from public.dumping_assignments where id=receipt.assignment_id));
 end if;

 assignment:=manufacturing_private.resolve_individual_job_qr(p_code);
 if assignment.id is distinct from p_assignment then
   raise exception 'The planned job changed. Review the assignment and confirm again.' using errcode='40001';
 end if;
 return manufacturing_private.scan_reusable_configured(assignment.id,p_request,p_pieces,p_expected_load);
end;
$$;

create or replace function public.app_issue_individual_job_qr(p_person text)
returns text language sql security invoker set search_path='' as $$
 select manufacturing_private.issue_individual_job_qr(p_person);
$$;
create or replace function public.app_individual_job_qr(p_code text)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.individual_job_qr(p_code);
$$;
create or replace function public.app_scan_individual_job_qr(
 p_code text,p_assignment text,p_request uuid,p_pieces integer,p_expected_load integer
) returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.scan_individual_job_qr(p_code,p_assignment,p_request,p_pieces,p_expected_load);
$$;

revoke all on function manufacturing_private.resolve_individual_job_qr(text) from public,anon,authenticated;
revoke all on function manufacturing_private.issue_individual_job_qr(text), manufacturing_private.individual_job_qr(text),
 manufacturing_private.scan_individual_job_qr(text,text,uuid,integer,integer),
 public.app_issue_individual_job_qr(text), public.app_individual_job_qr(text),
 public.app_scan_individual_job_qr(text,text,uuid,integer,integer) from public,anon;
grant execute on function manufacturing_private.issue_individual_job_qr(text), manufacturing_private.individual_job_qr(text),
 manufacturing_private.scan_individual_job_qr(text,text,uuid,integer,integer),
 public.app_issue_individual_job_qr(text), public.app_individual_job_qr(text),
 public.app_scan_individual_job_qr(text,text,uuid,integer,integer) to authenticated;

-- Releasing an assignment makes room for a new job on the same day. Keep the
-- old label and its completion records for History and idempotent scan retries.
create or replace function manufacturing_private.release_job_qr_assignment(p_assignment text,p_date date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare oid text; assignment public.dumping_assignments;
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('admin','manager','coach','station','box_setup') then
   raise exception 'Plan access requires box setup permissions' using errcode='42501';
 end if;
 if p_date is null or not isfinite(p_date) or p_date<(now() at time zone 'America/Chicago')::date then
   raise exception 'Select an assignment for today or a future date';
 end if;
 select * into assignment from public.dumping_assignments where id=p_assignment and work_date=p_date;
 if assignment.id is null then raise exception 'Plan assignment no longer exists'; end if;
 perform manufacturing_private.dumping_access(assignment.sub_job_id,true);
 select w.order_id into oid from public.sub_jobs j join public.work_orders w on w.id=j.work_order_id
 where j.id=assignment.sub_job_id;
 perform 1 from public.orders where id=oid for update;
 perform pg_advisory_xact_lock(hashtextextended('day-plan:'||p_date::text,0));
 update public.dumping_assignments set active=false
 where id=p_assignment and work_date=p_date and active;
 if found then
   update public.orders set revision=revision+1,updated_at=now() where id=oid;
   insert into public.order_events(order_id,actor_id,message) values(oid,auth.uid(),
     format('Released plan assignment %s for reassignment. Recorded pieces retained.',p_assignment));
 end if;
 return manufacturing_private.day_plan(p_date);
end;
$$;
create or replace function public.app_release_job_qr_assignment(p_assignment text,p_date date)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.release_job_qr_assignment(p_assignment,p_date);
$$;
revoke all on function manufacturing_private.release_job_qr_assignment(text,date),
 public.app_release_job_qr_assignment(text,date) from public,anon;
grant execute on function manufacturing_private.release_job_qr_assignment(text,date),
 public.app_release_job_qr_assignment(text,date) to authenticated;
