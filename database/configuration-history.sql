-- Read-only, admin-only projections for the History tab. The chosen query is
-- an allowlisted constant. Filter values are passed as bound parameters.
create or replace function manufacturing_private.configuration_history(
 p_view text,p_start date,p_end date,p_search text,p_offset integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 headings text[];
 source_sql text;
 result jsonb;
begin
 perform manufacturing_private.require_admin_approvals();
 if (p_start is not null and not isfinite(p_start)) or (p_end is not null and not isfinite(p_end))
   or p_start>p_end or length(coalesce(p_search,''))>160
   or p_offset is null or p_offset not between 0 and 1000000 then
   raise exception 'Check the history filters';
 end if;

 case p_view
 when 'scans' then
   headings:=array['Time (Tulsa)', 'Individual', 'Order / item code', 'System ID', 'Order number', 'Work order', 'Sub-job', 'QR code', 'Type', 'Source', 'Pieces'];
   source_sql:=$view$
     select e.id as row_key,(e.completed_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(to_char(e.completed_at at time zone 'America/Chicago','HH24:MI:SS'),p.name,concat_ws(' · ',o.data->>'title',nullif(o.data->>'catalogCode','')),o.id,o.data->>'orderNumber',w.id,j.data->>'name',e.qr,e.kind,e.source,e.pieces) as cells,e.completed_at as sort_at
     from (select 'box:'||r.id as id,r.completed_at,b.person_id,b.sub_job_id,b.id qr,r.completed_pieces pieces,
          case when exists(select 1 from public.barcode_approval_batches a
            where a.actor_id=r.actor_id and a.created_at=r.completed_at and a.kind='box' and b.id=any(a.ids))
          then 'Admin approval' else 'Scan' end source,'Single-use' kind
        from public.production_records r join public.boxes b on b.id=r.box_id
        union all
        select 'reusable:'||c.id,c.completed_at,a.person_id,a.sub_job_id,a.id,c.pieces,'Scan','Reusable'
        from public.dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id) e join public.people p on p.id=e.person_id
      join public.sub_jobs j on j.id=e.sub_job_id
      join public.work_orders w on w.id=j.work_order_id
      join public.orders o on o.id=w.order_id
   $view$;
 when 'customers' then
   headings:=array['Client ID', 'Client'];
   source_sql:=$view$
     select c.id as row_key,(c.created_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(c.id,c.name) as cells,c.created_at as sort_at
     from public.customers c
   $view$;
 when 'customer_items' then
   headings:=array['Client', 'Item code', 'Item', 'Rate'];
   source_sql:=$view$
     select i.id::text as row_key,null::date as event_date,
       jsonb_build_array(c.name,i.code,i.name,i.rate) as cells,null::timestamptz as sort_at
     from public.customer_items i join public.customers c on c.id=i.customer_id
   $view$;
 when 'orders' then
   headings:=array['System ID', 'Order number', 'Order / item code', 'Client', 'Stage', 'Pieces', 'Pieces per pack', 'Required delivery'];
   source_sql:=$view$
     select o.id as row_key,(o.created_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(o.id,o.data->>'orderNumber',concat_ws(' · ',o.data->>'title',nullif(o.data->>'catalogCode','')),c.name,
        case o.stage when 0 then case when o.data->>'assignmentConfirmedAt' is not null then 'Plan Production'
          when o.data->>'workOrderApprovedAt' is not null or exists(select 1 from public.work_orders w where w.order_id=o.id)
          then 'Work Orders' else 'Order Requests' end
          when 1 then 'Plan Production' when 2 then 'Quality Check & Packing' when 3 then 'Quality Check & Packing'
          when 4 then 'Warehouse & Ready for Delivery' when 5 then 'Warehouse & Ready for Delivery' else 'Mark Complete' end,
        o.data->>'quantity',o.data->>'perPack',o.data->>'required') as cells,o.created_at as sort_at
     from public.orders o join public.customers c on c.id=o.customer_id
   $view$;
 when 'work_orders' then
   headings:=array['Work order', 'System ID', 'Order / item code', 'Description', 'Job type', 'Job Coach', 'Pieces', 'Pieces per pack', 'Pieces per scan', 'Scan delay (s)'];
   source_sql:=$view$
     select w.id as row_key,coalesce(nullif(w.data->>'startDate','')::date,(o.created_at at time zone 'America/Chicago')::date) as event_date,
       jsonb_build_array(w.id,o.id,concat_ws(' · ',o.data->>'title',nullif(o.data->>'catalogCode','')),w.data->>'description',w.data->>'type',p.name,w.quantity,w.pieces_per_pack,w.scan_pieces,w.scan_cooldown_seconds) as cells,null::timestamptz as sort_at
     from public.work_orders w join public.orders o on o.id=w.order_id left join public.people p on p.id=w.coach_id
   $view$;
 when 'sub_jobs' then
   headings:=array['Sub-job ID', 'Sub-job', 'Work order', 'System ID', 'Order / item code', 'Target pieces', 'Completed pieces', 'Pack type'];
   source_sql:=$view$
     select j.id as row_key,coalesce(nullif(w.data->>'startDate','')::date,(o.created_at at time zone 'America/Chicago')::date) as event_date,
       jsonb_build_array(j.id,j.data->>'name',w.id,o.id,concat_ws(' · ',o.data->>'title',nullif(o.data->>'catalogCode','')),j.quantity,j.completed,j.data->>'packType') as cells,null::timestamptz as sort_at
     from public.sub_jobs j join public.work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id
   $view$;
 when 'boxes' then
   headings:=array['QR code', 'Individual', 'System ID', 'Sub-job', 'Assigned pieces', 'Completed pieces', 'Completed date'];
   source_sql:=$view$
     select b.id as row_key,(b.created_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(b.id,p.name,w.order_id,j.data->>'name',b.quantity,b.completed_pieces,(b.completed_at at time zone 'America/Chicago')::date) as cells,b.created_at as sort_at
     from public.boxes b join public.people p on p.id=b.person_id join public.sub_jobs j on j.id=b.sub_job_id join public.work_orders w on w.id=j.work_order_id
   $view$;
 when 'production_records' then
   headings:=array['Time (Tulsa)', 'Individual', 'Order / item code', 'System ID', 'Order number', 'Work order', 'Sub-job', 'QR code', 'Type', 'Source', 'Pieces'];
   source_sql:=$view$
     select e.id as row_key,(e.completed_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(to_char(e.completed_at at time zone 'America/Chicago','HH24:MI:SS'),p.name,concat_ws(' · ',o.data->>'title',nullif(o.data->>'catalogCode','')),o.id,o.data->>'orderNumber',w.id,j.data->>'name',e.qr,e.kind,e.source,e.pieces) as cells,e.completed_at as sort_at
     from (select 'box:'||r.id as id,r.completed_at,b.person_id,b.sub_job_id,b.id qr,r.completed_pieces pieces,
          case when exists(select 1 from public.barcode_approval_batches a
            where a.actor_id=r.actor_id and a.created_at=r.completed_at and a.kind='box' and b.id=any(a.ids))
          then 'Admin approval' else 'Scan' end source,'Single-use' kind
        from public.production_records r join public.boxes b on b.id=r.box_id) e join public.people p on p.id=e.person_id
      join public.sub_jobs j on j.id=e.sub_job_id
      join public.work_orders w on w.id=j.work_order_id
      join public.orders o on o.id=w.order_id
   $view$;
 when 'dumping_assignments' then
   headings:=array['QR code', 'Individual', 'System ID', 'Sub-job', 'Plan ID', 'Pieces per scan', 'Active', 'Approved'];
   source_sql:=$view$
     select a.id as row_key,coalesce(a.work_date,(a.created_at at time zone 'America/Chicago')::date) as event_date,
       jsonb_build_array(a.id,p.name,w.order_id,j.data->>'name',a.plan_id,coalesce(w.scan_pieces,a.batch_quantity),a.active,a.plan_approved_at is not null) as cells,null::timestamptz as sort_at
     from public.dumping_assignments a join public.people p on p.id=a.person_id join public.sub_jobs j on j.id=a.sub_job_id join public.work_orders w on w.id=j.work_order_id
   $view$;
 when 'dumping_completions' then
   headings:=array['Time (Tulsa)', 'Individual', 'Order / item code', 'System ID', 'Order number', 'Work order', 'Sub-job', 'QR code', 'Type', 'Source', 'Pieces'];
   source_sql:=$view$
     select e.id as row_key,(e.completed_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(to_char(e.completed_at at time zone 'America/Chicago','HH24:MI:SS'),p.name,concat_ws(' · ',o.data->>'title',nullif(o.data->>'catalogCode','')),o.id,o.data->>'orderNumber',w.id,j.data->>'name',e.qr,e.kind,e.source,e.pieces) as cells,e.completed_at as sort_at
     from (select 'reusable:'||c.id as id,c.completed_at,a.person_id,a.sub_job_id,a.id as qr,c.pieces,'Scan' as source,'Reusable' as kind
        from public.dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id) e join public.people p on p.id=e.person_id
      join public.sub_jobs j on j.id=e.sub_job_id
      join public.work_orders w on w.id=j.work_order_id
      join public.orders o on o.id=w.order_id
   $view$;
 when 'people' then
   headings:=array['Individual ID', 'Name', 'Type', 'Role / skills', 'Hours per day', 'Weekly hours (Mon–Sun)', 'Active'];
   source_sql:=$view$
     select p.id as row_key,null::date as event_date,
       jsonb_build_array(p.id,p.name,p.kind,p.data->>'role',p.hours_per_day,p.data->'weeklyHours',p.data->>'active' is distinct from 'false') as cells,null::timestamptz as sort_at
     from public.people p
   $view$;
 when 'staff_profiles' then
   headings:=array['Name', 'Role', 'Linked individual', 'Active'];
   source_sql:=$view$
     select s.id::text as row_key,(s.created_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(s.display_name,s.role,p.name,s.active) as cells,s.created_at as sort_at
     from public.staff_profiles s left join public.people p on p.id=s.person_id
   $view$;
 when 'bookings' then
   headings:=array['Booking ID', 'Individual', 'System ID', 'Work order', 'End date', 'Hours', 'Status'];
   source_sql:=$view$
     select b.id as row_key,b.starts_on as event_date,
       jsonb_build_array(b.id,p.name,b.order_id,b.work_order_id,b.ends_on,b.hours,b.status) as cells,null::timestamptz as sort_at
     from public.bookings b join public.people p on p.id=b.person_id
   $view$;
 when 'individual_availability' then
   headings:=array['Individual', 'Status', 'Hours'];
   source_sql:=$view$
     select a.person_id||a.date::text as row_key,a.date as event_date,
       jsonb_build_array(p.name,a.status,a.hours) as cells,null::timestamptz as sort_at
     from public.individual_availability a join public.people p on p.id=a.person_id
   $view$;
 when 'daily_attendance' then
   headings:=array['Individual', 'Status', 'Arrival', 'Departure', 'Work hours'];
   source_sql:=$view$
     select a.person_id||a.date::text as row_key,a.date as event_date,
       jsonb_build_array(p.name,a.status,a.arrival,a.departure,a.work_hours) as cells,null::timestamptz as sort_at
     from public.daily_attendance a join public.people p on p.id=a.person_id
   $view$;
 when 'individual_timesheets' then
   headings:=array['Individual', 'Job Coach', 'Location', 'Last updated', 'Revision'];
   source_sql:=$view$
     select t.person_id||t.week_start::text as row_key,t.week_start as event_date,
       jsonb_build_array(p.name,t.data->>'coach',t.data->>'location',(t.updated_at at time zone 'America/Chicago')::date,t.revision) as cells,null::timestamptz as sort_at
     from public.individual_timesheets t join public.people p on p.id=t.person_id
   $view$;
 when 'quality_checks' then
   headings:=array['Check ID', 'System ID', 'Work order', 'Method', 'Inspector', 'Inspected', 'Failed'];
   source_sql:=$view$
     select q.id as row_key,(nullif(q.data->>'at','')::timestamptz at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(q.id,w.order_id,w.id,q.data->>'mode',q.data->>'inspector',q.data->>'inspected',q.data->>'failed') as cells,nullif(q.data->>'at','')::timestamptz as sort_at
     from public.quality_checks q join public.work_orders w on w.id=q.work_order_id
   $view$;
 when 'packing_checks' then
   headings:=array['Check ID', 'System ID', 'Work order', 'Packed correctly', 'Notes'];
   source_sql:=$view$
     select q.id as row_key,(nullif(q.data->>'at','')::timestamptz at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(q.id,w.order_id,w.id,q.data->'correct',q.data->>'notes') as cells,nullif(q.data->>'at','')::timestamptz as sort_at
     from public.packing_checks q join public.work_orders w on w.id=q.work_order_id
   $view$;
 when 'order_events' then
   headings:=array['Time (Tulsa)', 'System ID', 'Staff', 'Event'];
   source_sql:=$view$
     select e.id::text as row_key,(e.occurred_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(to_char(e.occurred_at at time zone 'America/Chicago','HH24:MI:SS'),e.order_id,s.display_name,e.message) as cells,e.occurred_at as sort_at
     from public.order_events e left join public.staff_profiles s on s.id=e.actor_id
   $view$;
 when 'workforce_changes' then
   headings:=array['Time (Tulsa)', 'Individual', 'Staff', 'Change', 'Active'];
   source_sql:=$view$
     select c.id::text as row_key,(c.at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(to_char(c.at at time zone 'America/Chicago','HH24:MI:SS'),p.name,s.display_name,c.kind,c.data->'active') as cells,c.at as sort_at
     from public.workforce_changes c left join public.people p on p.id=c.person_id left join public.staff_profiles s on s.id=c.actor_id
   $view$;
 when 'barcode_approval_batches' then
   headings:=array['Time (Tulsa)', 'Staff', 'Type', 'QR codes', 'Reason', 'Changed', 'Skipped', 'Pieces'];
   source_sql:=$view$
     select b.id::text as row_key,(b.created_at at time zone 'America/Chicago')::date as event_date,
       jsonb_build_array(to_char(b.created_at at time zone 'America/Chicago','HH24:MI:SS'),s.display_name,b.kind,b.ids,b.reason,b.outcome->>'changed',b.outcome->>'skipped',b.outcome->>'pieces') as cells,b.created_at as sort_at
     from public.barcode_approval_batches b left join public.staff_profiles s on s.id=b.actor_id
   $view$;
 when 'order_schedules' then
   headings:=array['Schedule ID', 'Client', 'Order title', 'Repeat interval (days)', 'Active'];
   source_sql:=$view$
     select s.id::text as row_key,s.next_due_date as event_date,
       jsonb_build_array(s.id,c.name,s.data->>'title',s.interval_days,s.active) as cells,null::timestamptz as sort_at
     from public.order_schedules s join public.customers c on c.id=s.customer_id
   $view$;
 when 'calendar_exceptions' then
   headings:=array['Individual', 'Available hours', 'Reason'];
   source_sql:=$view$
     select e.id::text as row_key,e.date as event_date,
       jsonb_build_array(p.name,e.available_hours,e.reason) as cells,null::timestamptz as sort_at
     from public.calendar_exceptions e left join public.people p on p.id=e.person_id
   $view$;
 when 'calendar_settings' then
   headings:=array['Time zone', 'Working weekdays', 'Hours per day'];
   source_sql:=$view$
     select s.id::text as row_key,null::date as event_date,
       jsonb_build_array(s.timezone,s.working_weekdays,s.hours_per_day) as cells,null::timestamptz as sort_at
     from public.calendar_settings s
   $view$;
 else raise exception 'Select a supported history view';
 end case;

 execute 'with filtered as (
   select row_key,event_date,cells,sort_at from ('||source_sql||') history
   where ($1::date is null or event_date >= $1) and ($2::date is null or event_date <= $2)
     and (coalesce(trim($3),'''')='''' or strpos(lower(cells::text),lower(trim($3)))>0)
 )
 select jsonb_build_object(''columns'',$5::text[],''total'',count(*),
   ''pieces'',case when $6::boolean then coalesce(sum((case when $6 then cells->>10 end)::bigint),0) end,
   ''rows'',
   coalesce((select jsonb_agg(to_jsonb(page) order by event_date desc nulls last,sort_at desc nulls last,row_key)
     from (select row_key,event_date,cells,sort_at from filtered order by event_date desc nulls last,sort_at desc nulls last,row_key limit 50 offset $4) page),''[]''))
 from filtered'
 into result using p_start,p_end,p_search,p_offset,headings,p_view in ('scans','production_records','dumping_completions');
 return result;
end;
$$;

create or replace function public.app_configuration_history(
 p_view text,p_start date,p_end date,p_search text,p_offset integer
) returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.configuration_history(p_view,p_start,p_end,p_search,p_offset);
$$;
revoke all on function manufacturing_private.configuration_history(text,date,date,text,integer),
 public.app_configuration_history(text,date,date,text,integer) from public,anon;
grant execute on function manufacturing_private.configuration_history(text,date,date,text,integer),
 public.app_configuration_history(text,date,date,text,integer) to authenticated;
