begin;
create table public.scan_assign_approvals (
 id uuid primary key default gen_random_uuid(),
 sub_job_id text not null references public.sub_jobs(id),
 work_date date not null check(isfinite(work_date)),
 pieces_per_scan integer not null check(pieces_per_scan between 1 and 1000000),
 approved_at timestamptz not null default now(),
 approved_by uuid not null references auth.users(id),
 revoked_at timestamptz,
 unique(sub_job_id,work_date)
);
alter table public.scan_assign_approvals enable row level security;
revoke all on public.scan_assign_approvals from public,anon,authenticated;
create index scan_assign_date_idx on public.scan_assign_approvals(work_date);
alter table public.dumping_assignments
 add column scan_assign_approval_id uuid references public.scan_assign_approvals(id),
 add column scan_assign_ready_at timestamptz;
create index scan_assign_assignment_idx on public.dumping_assignments(scan_assign_approval_id) where scan_assign_approval_id is not null;

create function manufacturing_private.scan_assign_approvals(p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r text:=manufacturing_private.actor_role();
begin
 if auth.uid() is null or coalesce(r,'') not in ('admin','manager','coach','station','box_setup','box_scanner') then
   raise exception 'Shop Floor access required' using errcode='42501';
 end if;
 if p_date is null or not isfinite(p_date) then raise exception 'Choose a valid work date'; end if;
 return coalesce((
   select jsonb_agg(jsonb_build_object('id',a.id,'jobId',j.id,'jobName',j.data->>'name',
     'orderId',o.id,'orderTitle',o.data->>'title','orderCode',o.data->>'catalogCode',
     'workDate',a.work_date,'piecesPerScan',a.pieces_per_scan,
     'assigned',(select count(*) from public.dumping_assignments d where d.scan_assign_approval_id=a.id and d.active))
     order by o.id,j.id)
   from public.scan_assign_approvals a join public.sub_jobs j on j.id=a.sub_job_id
   join public.work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id
   where a.work_date=p_date and a.revoked_at is null and o.stage=1 and j.completed<j.quantity
     and manufacturing_private.can_read_order(o.id)
     and (r<>'coach' or w.coach_id=(select person_id from public.staff_profiles where id=auth.uid()))
 ),'[]'::jsonb);
end $$;

create function manufacturing_private.approve_scan_assign(p_date date,p_job text,p_pieces integer,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.sub_jobs; w public.work_orders; approval public.scan_assign_approvals; qty integer;
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('admin','manager','coach','station','box_setup') then
   raise exception 'Plan approval access required' using errcode='42501';
 end if;
 if p_date is null or not isfinite(p_date) or p_date<(clock_timestamp() at time zone 'America/Chicago')::date or p_enabled is null then
   raise exception 'Choose today or a future work date';
 end if;
 perform manufacturing_private.dumping_access(p_job,true);
 select * into j from public.sub_jobs where id=p_job;
 select * into w from public.work_orders where id=j.work_order_id;
 perform 1 from public.orders where id=w.order_id and stage=1 for update;
 if not found then raise exception 'Select an order in production'; end if;
 select * into j from public.sub_jobs where id=p_job for update;
 select * into approval from public.scan_assign_approvals where sub_job_id=p_job and work_date=p_date for update;
 if not p_enabled then
   update public.scan_assign_approvals set revoked_at=clock_timestamp() where id=approval.id and revoked_at is null;
   update public.dumping_assignments set active=false where scan_assign_approval_id=approval.id and active;
 else
   if j.completed>=j.quantity then raise exception 'Select an unfinished sub-job'; end if;
   qty:=coalesce(p_pieces,w.scan_pieces,w.pieces_per_pack);
   if qty not between 1 and least(1000000,w.quantity) then raise exception 'Choose a valid number of pieces per scan'; end if;
   if approval.id is not null and exists(select 1 from public.dumping_assignments where scan_assign_approval_id=approval.id)
     and approval.pieces_per_scan<>qty then raise exception 'Pieces per scan cannot change after cards have been assigned'; end if;
   insert into public.scan_assign_approvals(sub_job_id,work_date,pieces_per_scan,approved_by)
   values(p_job,p_date,qty,auth.uid())
   on conflict(sub_job_id,work_date) do update set pieces_per_scan=excluded.pieces_per_scan,
     approved_at=now(),approved_by=auth.uid(),revoked_at=null;
 end if;
 update public.orders set revision=revision+1,updated_at=now() where id=w.order_id;
 insert into public.order_events(order_id,actor_id,message) values(w.order_id,auth.uid(),
   format('Scan & Assign %s for %s on %s.',case when p_enabled then 'approved' else 'revoked' end,p_job,p_date));
 return manufacturing_private.scan_assign_approvals(p_date);
end $$;

create function manufacturing_private.scan_and_assign(p_approval uuid,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 r text:=manufacturing_private.actor_role(); a public.scan_assign_approvals;
 person public.people; assignment public.dumping_assignments; j public.sub_jobs;
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
   update public.dumping_assignments set active=false
     where person_id=person.id and active and work_date is not null and work_date<today;
   perform manufacturing_private.require_person_free(person.id);
   insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,work_date,created_by,
     plan_id,plan_approved_at,personal_qr,scan_assign_approval_id,scan_assign_ready_at)
   values('REUSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),j.id,person.id,a.pieces_per_scan,today,auth.uid(),
     a.id,now(),true,a.id,clock_timestamp()+interval '1 minute')
   returning * into assignment;
   update public.orders set revision=revision+1,updated_at=now() where id=oid;
   insert into public.order_events(order_id,actor_id,message)
   values(oid,auth.uid(),format('Scan & Assign: %s assigned to %s; production unlocks in one minute.',person.name,j.id));
 end if;
 return jsonb_build_object('assignmentId',assignment.id,'personName',person.name,'piecesPerScan',assignment.batch_quantity,
   'readyAt',assignment.scan_assign_ready_at,
   'waitSeconds',greatest(0,ceil(extract(epoch from assignment.scan_assign_ready_at-clock_timestamp()))));
end $$;

-- Include these assignments in history, with their own approval controls.
do $$
declare definition text; hook text;
begin
 definition:=pg_get_functiondef('manufacturing_private.day_plan_group(date,text,text[],text[],uuid,boolean)'::regprocedure);
 hook:='if p_people is not null then';
 if position(hook in definition)=0 then raise exception 'Unexpected plan function'; end if;
 definition:=replace(definition,hook,hook||$guard$
   if exists(select 1 from public.dumping_assignments where plan_id=p_plan and scan_assign_approval_id is not null) then
     raise exception 'Manage this assignment through Scan & Assign';
   end if;$guard$);
 hook:='''personalQr'',a.personal_qr';
 if position(hook in definition)=0 then raise exception 'Unexpected plan projection'; end if;
 execute replace(definition,hook,hook||',''scanAssign'',a.scan_assign_approval_id is not null');

 definition:=pg_get_functiondef('manufacturing_private.resolve_individual_job_qr(text)'::regprocedure);
 hook:='if assignment.id is null then';
 if position(hook in definition)=0 then raise exception 'Unexpected personal QR resolver'; end if;
 execute replace(definition,hook,$ready$
 if assignment.scan_assign_ready_at>clock_timestamp() then
   raise exception 'This card is assigned. Wait % seconds before recording production.',
     ceil(extract(epoch from assignment.scan_assign_ready_at-clock_timestamp()));
 end if;
 $ready$||hook);
end $$;

create function public.app_scan_assign_approvals(p_date date)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.scan_assign_approvals(p_date);
$$;
create function public.app_approve_scan_assign(p_date date,p_job text,p_pieces integer,p_enabled boolean)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.approve_scan_assign(p_date,p_job,p_pieces,p_enabled);
$$;
create function public.app_scan_and_assign(p_approval uuid,p_code text)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.scan_and_assign(p_approval,p_code);
$$;
revoke all on function manufacturing_private.scan_assign_approvals(date),public.app_scan_assign_approvals(date),
 manufacturing_private.approve_scan_assign(date,text,integer,boolean),public.app_approve_scan_assign(date,text,integer,boolean),
 manufacturing_private.scan_and_assign(uuid,text),public.app_scan_and_assign(uuid,text) from public,anon;
grant execute on function manufacturing_private.scan_assign_approvals(date),public.app_scan_assign_approvals(date),
 manufacturing_private.approve_scan_assign(date,text,integer,boolean),public.app_approve_scan_assign(date,text,integer,boolean),
 manufacturing_private.scan_and_assign(uuid,text),public.app_scan_and_assign(uuid,text) to authenticated;
commit;
