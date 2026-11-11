begin;
create or replace function manufacturing_private.scan_and_assign(p_approval uuid,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 r text:=manufacturing_private.actor_role(); a public.scan_assign_approvals;
 person public.people; assignment public.dumping_assignments; j public.sub_jobs;
 previous_ids text[];
 oid text; today date:=(clock_timestamp() at time zone 'America/Chicago')::date;
begin
 if auth.uid() is null or coalesce(r,'') not in ('admin','manager','coach','station','box_setup','box_scanner') then
   raise exception 'Shop Floor access required' using errcode='42501';
 end if;
 select work_row.order_id into oid from public.scan_assign_approvals approval_row
 join public.sub_jobs job_row on job_row.id=approval_row.sub_job_id
 join public.work_orders work_row on work_row.id=job_row.work_order_id where approval_row.id=p_approval;
 if oid is null then raise exception 'Choose an approved Scan & Assign order'; end if;
 perform 1 from public.orders where id=oid and stage=1 for update;
 if not found then raise exception 'This order is no longer in production'; end if;
 select * into a from public.scan_assign_approvals where id=p_approval and revoked_at is null and work_date=today for update;
 if not found then raise exception 'This Scan & Assign approval is no longer active for today'; end if;
 perform manufacturing_private.dumping_access(a.sub_job_id,r='box_setup');
 perform pg_advisory_xact_lock(hashtextextended('day-plan:'||today::text,0));
 select * into person from public.people where job_qr_code=upper(trim(p_code)) and kind='individual' for update;
 if person.id is null then raise exception 'Scan a system-generated Individual Job QR card'; end if;
 if person.data->>'active'='false' or person.job_qr_expires_on<today then raise exception 'This individual is disabled or their QR card has expired'; end if;
 select * into j from public.sub_jobs where id=a.sub_job_id for update;
 if j.completed>=j.quantity then raise exception 'This sub-job is already complete'; end if;
 select * into assignment from public.dumping_assignments
 where scan_assign_approval_id=a.id and person_id=person.id and active for update;
 if assignment.id is null then
   -- Move the personal card to this job; retain all earlier labels and production.
   -- Future plans and unfinished single-use boxes remain available independently.
   with previous as (
     update public.dumping_assignments set active=false
     where person_id=person.id and active and (work_date is null or work_date<=today)
     returning id
   ) select coalesce(array_agg(id),'{}'::text[]) into previous_ids from previous;
   insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,work_date,created_by,
     plan_id,plan_approved_at,personal_qr,scan_assign_approval_id,scan_assign_ready_at)
   values('REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),j.id,person.id,a.pieces_per_scan,today,auth.uid(),
     a.id,now(),true,a.id,clock_timestamp()+interval '1 minute')
   returning * into assignment;
   update public.orders set revision=revision+1,updated_at=now() where id=oid;
   insert into public.order_events(order_id,actor_id,message)
   values(oid,auth.uid(),format('Scan & Assign: %s assigned to %s; production unlocks in one minute.%s',person.name,j.id,
     case when cardinality(previous_ids)>0 then ' Previous assignments released: '||array_to_string(previous_ids,', ')||'. Production history retained.' else '' end));
 end if;
 return jsonb_build_object('assignmentId',assignment.id,'personName',person.name,'piecesPerScan',assignment.batch_quantity,
   'reassigned',coalesce(cardinality(previous_ids),0)>0,
   'readyAt',assignment.scan_assign_ready_at,
   'waitSeconds',greatest(0,ceil(extract(epoch from assignment.scan_assign_ready_at-clock_timestamp()))));
end $$;

commit;
