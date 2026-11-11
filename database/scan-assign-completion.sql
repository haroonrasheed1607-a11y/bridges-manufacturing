begin;
alter table public.scan_assign_approvals
 add column completed_at timestamptz,
 add column completed_by uuid references auth.users(id),
 add constraint scan_assign_completion_actor check((completed_at is null)=(completed_by is null));
create index scan_assign_completed_by_idx on public.scan_assign_approvals(completed_by) where completed_by is not null;

do $$
declare original text; definition text;
begin
 original:=pg_get_functiondef('manufacturing_private.scan_assign_approvals(date)'::regprocedure);
 definition:=replace(original,'''workDate'',a.work_date,''piecesPerScan'',a.pieces_per_scan,',
  '''workDate'',a.work_date,''approvedAt'',a.approved_at,''piecesPerScan'',a.pieces_per_scan,');
 if definition=original then raise exception 'Unexpected approval projection';end if;
 execute definition;
 original:=pg_get_functiondef('manufacturing_private.approve_scan_assign(date,text,integer,boolean)'::regprocedure);
 definition:=replace(original,'approved_at=now(),approved_by=auth.uid(),revoked_at=null;',
  'approved_at=clock_timestamp(),approved_by=auth.uid(),revoked_at=null,completed_at=null,completed_by=null;');
 if definition=original then raise exception 'Unexpected approval renewal';end if;
 execute definition;
end $$;

create function manufacturing_private.complete_scan_assign(p_approval uuid,p_date date,p_approved_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare approval public.scan_assign_approvals; oid text; closed integer;
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('admin','manager','coach','station','box_setup') then
  raise exception 'Plan approval access required' using errcode='42501';
 end if;
 select w.order_id into oid from public.scan_assign_approvals a join public.sub_jobs j on j.id=a.sub_job_id
 join public.work_orders w on w.id=j.work_order_id where a.id=p_approval;
 if oid is null then raise exception 'Select an existing Scan & Assign approval';end if;
 perform 1 from public.orders where id=oid for update;
 select * into approval from public.scan_assign_approvals where id=p_approval for update;
 perform manufacturing_private.dumping_access(approval.sub_job_id,true);
 if p_date is distinct from approval.work_date or p_approved_at is distinct from approval.approved_at then
  raise exception 'This approval changed. Refresh and review it before marking complete.' using errcode='40001';
 end if;
 if approval.completed_at is null then
  update public.scan_assign_approvals set completed_at=clock_timestamp(),completed_by=auth.uid(),
   revoked_at=coalesce(revoked_at,clock_timestamp()) where id=approval.id;
  update public.dumping_assignments set active=false where scan_assign_approval_id=approval.id and active;
  get diagnostics closed=row_count;
  update public.orders set revision=revision+1,updated_at=clock_timestamp() where id=oid;
  insert into public.order_events(order_id,actor_id,message) values(oid,auth.uid(),
   format('Scan & Assign marked complete for %s on %s. Removed from Shop Floor; %s assignments closed. Recorded production retained.',approval.sub_job_id,approval.work_date,closed));
 end if;
 return manufacturing_private.scan_assign_approvals(approval.work_date);
end $$;
create function public.app_complete_scan_assign(p_approval uuid,p_date date,p_approved_at timestamptz)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.complete_scan_assign(p_approval,p_date,p_approved_at);
$$;
revoke all on function manufacturing_private.complete_scan_assign(uuid,date,timestamptz),public.app_complete_scan_assign(uuid,date,timestamptz) from public,anon;
grant execute on function manufacturing_private.complete_scan_assign(uuid,date,timestamptz),public.app_complete_scan_assign(uuid,date,timestamptz) to authenticated;
commit;
