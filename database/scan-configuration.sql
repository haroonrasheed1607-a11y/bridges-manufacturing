alter table public.work_orders
 add column if not exists scan_cooldown_seconds integer check(scan_cooldown_seconds between 0 and 604800),
 add column if not exists scan_pieces integer check(scan_pieces between 1 and 1000000);

create index if not exists production_records_completed_idx on public.production_records(completed_at desc);
create index if not exists reusable_completions_completed_idx on public.dumping_completions(completed_at desc);

create or replace function manufacturing_private.save_scan_settings(p_work text,p_seconds integer,p_pieces integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare oid text;
begin
 perform manufacturing_private.require_admin_approvals();
 if p_seconds not between 0 and 604800 or p_pieces not between 1 and 1000000 then
   raise exception 'Enter 0–604800 seconds and 1–1000000 pieces, or leave the fields blank for defaults';
 end if;
 select o.id into oid from public.orders o join public.work_orders w on w.order_id=o.id
 where w.id=p_work and o.stage=1 for update of o;
 if oid is null then raise exception 'Select a work order in production'; end if;
 if p_pieces>(select quantity from public.work_orders where id=p_work) then
   raise exception 'Pieces per scan cannot exceed the work order quantity';
 end if;
 update public.work_orders set scan_cooldown_seconds=p_seconds,scan_pieces=p_pieces
 where id=p_work and (scan_cooldown_seconds,scan_pieces) is distinct from (p_seconds,p_pieces);
 if found then
   update public.orders set revision=revision+1,updated_at=now() where id=oid;
   insert into public.order_events(order_id,actor_id,message) values(oid,auth.uid(),
     format('Scan settings for %s: %s seconds per load, %s pieces per load.',p_work,
       coalesce(p_seconds::text,'calculated'),coalesce(p_pieces::text,'label default')));
 end if;
 return jsonb_build_object('seconds',p_seconds,'pieces',p_pieces);
end;
$$;

create or replace function manufacturing_private.scan_history(
 p_start date,p_end date,p_kind text,p_person text,p_order text,p_search text,p_offset integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform manufacturing_private.require_admin_approvals();
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_start>p_end
   or p_kind is null or p_kind not in ('all','box','reusable')
   or p_offset is null or p_offset not between 0 and 1000000 or length(coalesce(p_search,''))>160
 then raise exception 'Check the scan history filters'; end if;
 with events as (
   select r.id::text,b.id qr,b.person_id,b.sub_job_id,r.completed_at,r.completed_pieces pieces,'box'::text kind,
     case when exists(select 1 from public.barcode_approval_batches a
       where a.actor_id=r.actor_id and a.created_at=r.completed_at and a.kind='box' and b.id=any(a.ids))
     then 'Admin approval' else 'Scan' end source
   from public.production_records r join public.boxes b on b.id=r.box_id
   where p_kind in ('all','box')
     and r.completed_at>=(p_start::timestamp at time zone 'America/Chicago')
     and r.completed_at<((p_end+1)::timestamp at time zone 'America/Chicago')
   union all
   select c.id::text,a.id,a.person_id,a.sub_job_id,c.completed_at,c.pieces,'reusable','Scan'
   from public.dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id
   where p_kind in ('all','reusable')
     and c.completed_at>=(p_start::timestamp at time zone 'America/Chicago')
     and c.completed_at<((p_end+1)::timestamp at time zone 'America/Chicago')
 ), filtered as (
   select e.id,e.qr,e.completed_at,e.pieces,e.kind,e.source,p.name person,o.id order_id,
     o.data->>'title' title,o.data->>'catalogCode' code,w.id work_id,j.data->>'name' sub_job
   from events e join public.people p on p.id=e.person_id
   join public.sub_jobs j on j.id=e.sub_job_id join public.work_orders w on w.id=j.work_order_id
   join public.orders o on o.id=w.order_id
   where (p_person is null or e.person_id=p_person) and (p_order is null or o.id=p_order)
     and (coalesce(trim(p_search),'')='' or strpos(lower(concat_ws(' ',e.qr,p.name,o.id,o.data->>'title',
       o.data->>'catalogCode',o.data->>'orderNumber',w.id,j.data->>'name')),lower(trim(p_search)))>0)
 )
 select jsonb_build_object('total',count(*),'pieces',coalesce(sum(pieces),0),'rows',
   coalesce((select jsonb_agg(to_jsonb(page) order by completed_at desc,kind,id)
     from (select * from filtered order by completed_at desc,kind,id limit 50 offset p_offset) page),'[]'))
 into result from filtered;
 return result;
end;
$$;

-- Keep the current authorization, idempotency, and capacity checks.
do $patch$
declare
 definition text;
 hook text;
 name regprocedure;
begin
 name:='manufacturing_private.dumping_scan(text,uuid,integer)'::regprocedure;
 definition:=pg_get_functiondef(name);
 if position('w.scan_pieces' in definition)=0 then
   hook:='qty:=coalesce(p_pieces,a.batch_quantity);';
   if position(hook in definition)=0 or position('if a.last_scan_at is not null then' in definition)=0 then
     raise exception 'Unexpected reusable scan definition';
   end if;
   definition:=replace(definition,hook,
     'select * into w from public.work_orders where id=j.work_order_id;'||chr(10)||
     ' a.batch_quantity:=coalesce(w.scan_pieces,a.batch_quantity);'||chr(10)||' '||hook);
   definition:=replace(definition,'if a.last_scan_at is not null then',
     'if w.scan_cooldown_seconds is not null then fill_seconds:=ceil(w.scan_cooldown_seconds * fill_pieces::numeric / a.batch_quantity); end if;'||
     chr(10)||' if a.last_scan_at is not null then');
   execute definition;
 end if;

 foreach name in array array['manufacturing_private.reusable_barcode(text)'::regprocedure,
   'manufacturing_private.day_plan_group(date,text,text[],text[],uuid)'::regprocedure,
   'manufacturing_private.dumping_list()'::regprocedure] loop
   definition:=pg_get_functiondef(name);
   if position('scan_pieces' in definition)=0 then
     hook:='''batchQuantity'',a.batch_quantity';
     if position(hook in definition)=0 then raise exception 'Unexpected label projection: %',name; end if;
     if name='manufacturing_private.reusable_barcode(text)'::regprocedure then
       definition:=replace(definition,hook,'''batchQuantity'',coalesce((select w.scan_pieces from public.work_orders w join public.sub_jobs j on j.work_order_id=w.id where j.id=a.sub_job_id),a.batch_quantity)');
     elsif name='manufacturing_private.day_plan_group(date,text,text[],text[],uuid)'::regprocedure then
       definition:=replace(definition,hook,'''batchQuantity'',coalesce(wo.scan_pieces,a.batch_quantity)');
     else
       definition:=replace(definition,hook,'''batchQuantity'',coalesce(w.scan_pieces,a.batch_quantity)');
     end if;
     execute definition;
   end if;
 end loop;

 definition:=pg_get_functiondef('manufacturing_private.read_order(text)'::regprocedure);
 if position('scan_cooldown_seconds' in definition)=0 then
   hook:='''perPack'',w.pieces_per_pack,';
   if position(hook in definition)=0 then raise exception 'Unexpected work order projection'; end if;
   definition:=replace(definition,hook,hook||
     '''scanCooldownSeconds'',case when r=''admin'' then w.scan_cooldown_seconds end,''scanPieces'',case when r=''admin'' then w.scan_pieces end,');
   execute definition;
 end if;
end
$patch$;

create or replace function public.app_save_scan_settings(p_work text,p_seconds integer,p_pieces integer)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.save_scan_settings(p_work,p_seconds,p_pieces);
$$;
create or replace function public.app_scan_history(
 p_start date,p_end date,p_kind text,p_person text,p_order text,p_search text,p_offset integer
) returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.scan_history(p_start,p_end,p_kind,p_person,p_order,p_search,p_offset);
$$;

revoke all on function manufacturing_private.save_scan_settings(text,integer,integer),
 manufacturing_private.scan_history(date,date,text,text,text,text,integer),
 public.app_save_scan_settings(text,integer,integer),public.app_scan_history(date,date,text,text,text,text,integer) from public,anon;
grant execute on function manufacturing_private.save_scan_settings(text,integer,integer),
 manufacturing_private.scan_history(date,date,text,text,text,text,integer),
 public.app_save_scan_settings(text,integer,integer),public.app_scan_history(date,date,text,text,text,text,integer) to authenticated;

-- Scanner screens opened before a settings change must confirm the updated load.
-- A retry of a recorded request still returns the original receipt.
create or replace function manufacturing_private.scan_reusable_configured(
 p_id text,p_request uuid,p_pieces integer,p_expected_load integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare oid text; jid text; load_size integer;
begin
 if p_expected_load is not null then
   select w.order_id,j.id into oid,jid from public.dumping_assignments a
   join public.sub_jobs j on j.id=a.sub_job_id join public.work_orders w on w.id=j.work_order_id
   where a.id=upper(trim(p_id));
   if jid is not null then
     perform manufacturing_private.dumping_access(jid,false);
     perform 1 from public.orders where id=oid for update;
     if not exists(select 1 from public.dumping_completions where id=p_request) then
       select coalesce(w.scan_pieces,a.batch_quantity) into load_size
       from public.dumping_assignments a join public.sub_jobs j on j.id=a.sub_job_id
       join public.work_orders w on w.id=j.work_order_id where a.id=upper(trim(p_id));
       if load_size is distinct from p_expected_load then
         raise exception 'Pieces per scan changed. Review the updated load and confirm again.' using errcode='40001';
       end if;
     end if;
   end if;
 end if;
 return manufacturing_private.dumping_scan(p_id,p_request,p_pieces);
end;
$$;

create or replace function public.app_scan_reusable_configured(
 p_id text,p_request uuid,p_pieces integer,p_expected_load integer
) returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.scan_reusable_configured(p_id,p_request,p_pieces,p_expected_load);
$$;
revoke all on function manufacturing_private.scan_reusable_configured(text,uuid,integer,integer),
 public.app_scan_reusable_configured(text,uuid,integer,integer) from public,anon;
grant execute on function manufacturing_private.scan_reusable_configured(text,uuid,integer,integer),
 public.app_scan_reusable_configured(text,uuid,integer,integer) to authenticated;
