-- STAGING ONLY until the Version 2.0 release is approved.
do $$ begin
 if not exists(select 1 from public.customers where id='STAGE-CLIENT') then
  raise exception 'Staging-only migration: staging fixture is required';
 end if;
end $$;
alter table public.orders add column total_billable_units integer check(total_billable_units between 1 and 1000000);
alter table public.work_orders add column billable_units_per_scan integer check(billable_units_per_scan between 1 and 1000000);
alter table public.sub_jobs add column total_billable_units integer check(total_billable_units between 1 and 1000000),
 add column billable_units_completed integer check(billable_units_completed>=0 and billable_units_completed<=total_billable_units);
alter table public.dumping_completions add column billable_units integer check(billable_units>=0),
 add column billing_rate_snapshot numeric, add column pay_rate_snapshot numeric, add column billable_unit_label text;
alter table public.production_records add column billable_units integer check(billable_units>=0),
 add column billing_rate_snapshot numeric, add column pay_rate_snapshot numeric, add column billable_unit_label text;

-- New orders use unit counts as the compatibility quantity consumed by existing
-- allocation/capacity APIs. This is NOT a pieces-per-unit conversion. Historical
-- quantities and scan rows remain untouched, with NULL billable columns.
create function manufacturing_private.plan_billable_order(p_customer text,p_item uuid,p_total_units integer,p_units_per_scan integer,p_date date,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
<<billable_plan>>
declare result jsonb; existing public.plan_order_requests;
begin
 perform manufacturing_private.require_manager();
 if p_total_units is null or p_total_units not between 1 and 1000000 or p_units_per_scan is null or p_units_per_scan not between 1 and p_total_units then
  raise exception 'Enter total billable units and units per scan from 1 to the total';end if;
 if p_request is null then raise exception 'A request reference is required';end if;
 perform pg_advisory_xact_lock(hashtextextended('plan-create-order:'||p_request::text,0));
 select * into existing from public.plan_order_requests where request_id=p_request;
 if existing.request_id is not null then
  if existing.actor_id is distinct from auth.uid() or existing.customer_id is distinct from p_customer or existing.item_id is distinct from p_item
   or existing.quantity is distinct from p_total_units or (existing.result->>'billableUnitsPerScan')::integer is distinct from p_units_per_scan
  then raise exception 'This plan request reference has already been used';end if;
  return existing.result||'{"duplicate":true}';
 end if;
 result:=manufacturing_private.plan_create_order(p_customer,p_item,p_total_units,p_date,p_request);
 update public.orders set total_billable_units=p_total_units,
 data=data||jsonb_build_object('billableUnitLabel',(select unit from public.customer_items where id=p_item)) where id=result->>'orderId';
 update public.work_orders set billable_units_per_scan=p_units_per_scan,scan_pieces=p_units_per_scan where id=result->>'workId';
 update public.sub_jobs set total_billable_units=p_total_units,billable_units_completed=0 where id=result->>'jobId';
 update public.scan_assign_approvals set pieces_per_scan=p_units_per_scan where id=(result->>'approvalId')::uuid;
 result:=result||jsonb_build_object('billableMode',true,'totalBillableUnits',p_total_units,'billableUnitsPerScan',p_units_per_scan,'piecesPerScan',p_units_per_scan);
 update public.plan_order_requests set result=billable_plan.result where request_id=p_request;
 return result;
end $$;
create function public.app_plan_billable_order(p_customer text,p_item uuid,p_total_units integer,p_units_per_scan integer,p_date date,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$ select manufacturing_private.plan_billable_order(p_customer,p_item,p_total_units,p_units_per_scan,p_date,p_request); $$;

create function manufacturing_private.capture_billable_scan() returns trigger language plpgsql security definer set search_path='' as $$
declare oid text; units integer; rates jsonb; billable boolean;
begin
 if tg_table_name='dumping_completions' then
  select w.order_id into oid from public.dumping_assignments a join public.sub_jobs j on j.id=a.sub_job_id join public.work_orders w on w.id=j.work_order_id where a.id=new.assignment_id;
  units:=new.pieces;
 else
  select w.order_id into oid from public.boxes b join public.sub_jobs j on j.id=b.sub_job_id join public.work_orders w on w.id=j.work_order_id where b.id=new.box_id;
  units:=new.completed_pieces;
 end if;
 select total_billable_units is not null,data into billable,rates from public.orders where id=oid;
 if not coalesce(billable,false) or (tg_op='UPDATE' and old.billable_units is null) then return new;end if;
 new.billable_units:=units;
 if tg_op='INSERT' then
  new.billing_rate_snapshot:=case when jsonb_typeof(rates->'catalogRate')='number' then (rates->>'catalogRate')::numeric end;
  new.pay_rate_snapshot:=case when jsonb_typeof(rates->'individualRate')='number' then (rates->>'individualRate')::numeric else new.billing_rate_snapshot end;
  new.billable_unit_label:=coalesce(rates->>'billableUnitLabel','Item');
 else
  new.billing_rate_snapshot:=old.billing_rate_snapshot;new.pay_rate_snapshot:=old.pay_rate_snapshot;new.billable_unit_label:=old.billable_unit_label;
 end if;
 return new;
end $$;
create function manufacturing_private.accumulate_billable_scan() returns trigger language plpgsql security definer set search_path='' as $$
declare jid text; delta integer;
begin
 delta:=coalesce(case when tg_op<>'DELETE' then new.billable_units end,0)-coalesce(case when tg_op<>'INSERT' then old.billable_units end,0);
 if delta=0 then return null;end if;
 if tg_table_name='dumping_completions' then
  select sub_job_id into jid from public.dumping_assignments where id=case when tg_op='DELETE' then old.assignment_id else new.assignment_id end;
 else
  select sub_job_id into jid from public.boxes where id=case when tg_op='DELETE' then old.box_id else new.box_id end;
 end if;
 update public.sub_jobs set billable_units_completed=coalesce(billable_units_completed,0)+delta where id=jid and total_billable_units is not null;
 return null;
end $$;
create trigger capture_billable_scan before insert or update on public.dumping_completions for each row execute function manufacturing_private.capture_billable_scan();
create trigger capture_billable_scan before insert or update on public.production_records for each row execute function manufacturing_private.capture_billable_scan();
create trigger accumulate_billable_scan after insert or update or delete on public.dumping_completions for each row execute function manufacturing_private.accumulate_billable_scan();
create trigger accumulate_billable_scan after insert or update or delete on public.production_records for each row execute function manufacturing_private.accumulate_billable_scan();

create function manufacturing_private.save_billable_scan_settings(p_work text,p_seconds integer,p_units integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 perform manufacturing_private.require_admin_approvals();
 if p_units is null or not exists(select 1 from public.work_orders w join public.orders o on o.id=w.order_id where w.id=p_work and o.total_billable_units is not null) then raise exception 'Select a billable-unit work order and units per scan';end if;
 result:=manufacturing_private.save_scan_settings(p_work,p_seconds,p_units);
 update public.work_orders set billable_units_per_scan=p_units where id=p_work;
 update public.dumping_assignments a set batch_quantity=p_units from public.sub_jobs j where a.sub_job_id=j.id and j.work_order_id=p_work and a.active;
 update public.scan_assign_approvals a set pieces_per_scan=p_units from public.sub_jobs j where a.sub_job_id=j.id and j.work_order_id=p_work and a.completed_at is null and a.revoked_at is null;
 return result||jsonb_build_object('billableUnitsPerScan',p_units);
end $$;
create function public.app_save_billable_scan_settings(p_work text,p_seconds integer,p_units integer)
returns jsonb language sql security invoker set search_path='' as $$ select manufacturing_private.save_billable_scan_settings(p_work,p_seconds,p_units); $$;

create function manufacturing_private.scan_billable_units(p_code text,p_assignment text,p_request uuid,p_units integer,p_expected_load integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt jsonb; row public.dumping_completions;
begin
 if p_code like 'IND-%' then receipt:=manufacturing_private.scan_individual_job_qr(p_code,p_assignment,p_request,p_units,p_expected_load);
 else receipt:=manufacturing_private.scan_reusable_configured(p_code,p_request,p_units,p_expected_load);end if;
 select * into row from public.dumping_completions where id=(receipt->>'eventId')::uuid;
 return receipt||jsonb_build_object('billableUnits',row.billable_units,'billableMode',row.billable_units is not null,'unitLabel',row.billable_unit_label);
end $$;
create function public.app_scan_billable_units(p_code text,p_assignment text,p_request uuid,p_units integer,p_expected_load integer)
returns jsonb language sql security invoker set search_path='' as $$ select manufacturing_private.scan_billable_units(p_code,p_assignment,p_request,p_units,p_expected_load); $$;

-- Add projections without changing legacy responses or permissions.
do $patch$
declare original text; definition text;
begin
 original:=pg_get_functiondef('manufacturing_private.read_order(text)'::regprocedure);
 definition:=replace(original,'''id'',o.id,''stage''','''totalBillableUnits'',o.total_billable_units,''billableUnitsCompleted'',(select coalesce(sum(s.billable_units_completed),0) from public.sub_jobs s join public.work_orders ww on ww.id=s.work_order_id where ww.order_id=o.id),''id'',o.id,''stage''');
 definition:=replace(definition,'''id'',w.id,''createdAt''','''billableUnitsPerScan'',w.billable_units_per_scan,''id'',w.id,''createdAt''');
 definition:=replace(definition,'''id'',j.id,''quantity''','''totalBillableUnits'',j.total_billable_units,''billableUnitsCompleted'',j.billable_units_completed,''id'',j.id,''quantity''');
 if definition=original then raise exception 'Unexpected order projection';end if;execute definition;
 original:=pg_get_functiondef('manufacturing_private.reusable_barcode(text)'::regprocedure);
 definition:=replace(original,'''id'',a.id,','''remainingBillableUnits'',(select greatest(0,j.total_billable_units-coalesce(j.billable_units_completed,0)-coalesce((select sum(b.quantity) from public.boxes b where b.sub_job_id=j.id and b.completed_at is null),0)) from public.sub_jobs j where j.id=a.sub_job_id),''billableMode'',(select o.total_billable_units is not null from public.sub_jobs j join public.work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id where j.id=a.sub_job_id),''id'',a.id,');
 if definition=original then raise exception 'Unexpected QR projection';end if;execute definition;
 original:=pg_get_functiondef('manufacturing_private.planned_jobs(date)'::regprocedure);
 definition:=replace(original,'''jobId'',j.id,','''billableMode'',o.total_billable_units is not null,''billableUnitsPerScan'',w.billable_units_per_scan,''jobId'',j.id,');
 if definition=original then raise exception 'Unexpected planned projection';end if;execute definition;
 original:=pg_get_functiondef('manufacturing_private.timesheet(text,date,jsonb,bigint)'::regprocedure);
 definition:=replace(original,'''pieces'',b.completed_pieces','''billableUnits'',(select r.billable_units from public.production_records r where r.box_id=b.id limit 1),''pieces'',b.completed_pieces');
 definition:=replace(definition,'''pieces'',c.pieces','''billableUnits'',c.billable_units,''pieces'',c.pieces');
 if definition=original then raise exception 'Unexpected timesheet projection';end if;execute definition;
 original:=pg_get_functiondef('manufacturing_private.dumping_scan(text,uuid,integer,boolean)'::regprocedure);
 definition:=replace(original,'if a.personal_qr is not true then a.batch_quantity:=coalesce(w.scan_pieces,a.batch_quantity); end if;',
 'if o.total_billable_units is not null then a.batch_quantity:=w.billable_units_per_scan; elsif a.personal_qr is not true then a.batch_quantity:=coalesce(w.scan_pieces,a.batch_quantity); end if;');
 definition:=replace(definition,'if a.personal_qr is true and p_pieces is distinct from','if a.personal_qr is true and o.total_billable_units is null and p_pieces is distinct from');
 if definition=original then raise exception 'Unexpected personal load guard';end if;execute definition;
 original:=pg_get_functiondef('manufacturing_private.accounts_payroll_report(date)'::regprocedure);
 definition:=replace(original,'b.completed_pieces as pieces','coalesce(r.billable_units,b.completed_pieces) as pieces,r.billable_units,r.pay_rate_snapshot');
 definition:=replace(definition,'from public.boxes b','from public.boxes b left join lateral (select rr.billable_units,rr.pay_rate_snapshot from public.production_records rr where rr.box_id=b.id order by rr.completed_at desc limit 1) r on true');
 definition:=replace(definition,'c.completed_at,c.pieces','c.completed_at,coalesce(c.billable_units,c.pieces),c.billable_units,c.pay_rate_snapshot');
 definition:=replace(definition,$old$case when jsonb_typeof(o.data->'catalogRate')='number'$old$,$new$case when s.billable_units is not null then s.pay_rate_snapshot when jsonb_typeof(o.data->'catalogRate')='number'$new$);
 if definition=original then raise exception 'Unexpected payroll projection';end if;execute definition;
end $patch$;

create function manufacturing_private.billable_unit_report(p_start date,p_end date,p_offset integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'') not in ('accounts','admin','manager') then raise exception 'Accounts access required' using errcode='42501';end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<p_start or p_end-p_start>366 or p_offset is null or p_offset not between 0 and 1000000 then raise exception 'Select a date range of up to one year';end if;
 with scans as (
 select a.person_id,a.sub_job_id,c.completed_at,c.billable_units,c.billing_rate_snapshot,c.pay_rate_snapshot,c.billable_unit_label from public.dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id where c.billable_units is not null
 union all
 select b.person_id,b.sub_job_id,r.completed_at,r.billable_units,r.billing_rate_snapshot,r.pay_rate_snapshot,r.billable_unit_label from public.production_records r join public.boxes b on b.id=r.box_id where r.billable_units is not null
 ), grouped as (
 select c.name client,o.id order_id,o.data->>'catalogCode' item_code,o.data->>'title' item,p.name individual,s.billable_unit_label unit,
 sum(s.billable_units) units,count(*) scans,
 case when count(*) filter(where s.billing_rate_snapshot is null)=0 then round(sum(s.billable_units*s.billing_rate_snapshot),2) end client_payment,
 case when count(*) filter(where s.pay_rate_snapshot is null)=0 then round(sum(s.billable_units*s.pay_rate_snapshot),2) end individual_pay
 from scans s join public.people p on p.id=s.person_id join public.sub_jobs j on j.id=s.sub_job_id join public.work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id join public.customers c on c.id=o.customer_id
 where s.completed_at>=p_start::timestamp at time zone 'America/Chicago' and s.completed_at<(p_end+1)::timestamp at time zone 'America/Chicago'
 group by c.name,o.id,p.id,s.billable_unit_label
 ) select jsonb_build_object('total',count(*),'units',coalesce(sum(units),0),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from (select * from grouped order by client,item_code,individual,order_id limit 50 offset p_offset) page),'[]')) into result from grouped;
 return result;
end $$;
create function public.app_billable_unit_report(p_start date,p_end date,p_offset integer)
returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.billable_unit_report(p_start,p_end,p_offset);$$;

revoke all on function manufacturing_private.capture_billable_scan(),manufacturing_private.accumulate_billable_scan() from public,anon,authenticated;
revoke all on function manufacturing_private.plan_billable_order(text,uuid,integer,integer,date,uuid),public.app_plan_billable_order(text,uuid,integer,integer,date,uuid),manufacturing_private.save_billable_scan_settings(text,integer,integer),public.app_save_billable_scan_settings(text,integer,integer),manufacturing_private.scan_billable_units(text,text,uuid,integer,integer),public.app_scan_billable_units(text,text,uuid,integer,integer),manufacturing_private.billable_unit_report(date,date,integer),public.app_billable_unit_report(date,date,integer) from public,anon;
grant execute on function manufacturing_private.plan_billable_order(text,uuid,integer,integer,date,uuid),public.app_plan_billable_order(text,uuid,integer,integer,date,uuid),manufacturing_private.save_billable_scan_settings(text,integer,integer),public.app_save_billable_scan_settings(text,integer,integer),manufacturing_private.scan_billable_units(text,text,uuid,integer,integer),public.app_scan_billable_units(text,text,uuid,integer,integer),manufacturing_private.billable_unit_report(date,date,integer),public.app_billable_unit_report(date,date,integer) to authenticated;
