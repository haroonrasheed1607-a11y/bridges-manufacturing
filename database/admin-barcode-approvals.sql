begin;
create table public.barcode_approval_batches(id uuid primary key,actor_id uuid not null references auth.users(id),kind text not null check(kind in ('box','dumping')),ids text[] not null,reason text not null,outcome jsonb not null,created_at timestamptz not null default now());
create index approval_actor_idx on public.barcode_approval_batches(actor_id,created_at);
alter table public.barcode_approval_batches enable row level security;
revoke all on public.barcode_approval_batches from public,anon,authenticated;
create function manufacturing_private.require_admin_approvals() returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or coalesce(manufacturing_private.actor_role(),'')<>'admin' then raise exception 'Administrator access required' using errcode='42501';end if;
end$$;
create function manufacturing_private.barcode_queue(p_kind text default 'box',p_start date default null,p_end date default null,p_search text default '',p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$declare rows jsonb;total bigint;begin
 perform manufacturing_private.require_admin_approvals();
 if p_kind is null or p_kind not in ('box','dumping') or p_offset is null or p_offset<0 or p_offset>1000000 or (p_start is not null and p_end is not null and p_start>p_end) then raise exception 'Invalid filters';end if;
 with queue as (
  select b.id,p.name person,o.id order_id,o.data->>'title' title,w.data->>'description' description,j.data->>'name' job,b.quantity,coalesce(b.data->>'date',(b.created_at at time zone 'America/Chicago')::date::text) date,b.created_at from public.boxes b join public.people p on p.id=b.person_id join public.sub_jobs j on j.id=b.sub_job_id join public.work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id where p_kind='box' and b.completed_at is null
  union all
  select a.id,p.name,o.id,o.data->>'title',w.data->>'description',j.data->>'name',a.batch_quantity,(a.created_at at time zone 'America/Chicago')::date::text,a.created_at from public.dumping_assignments a join public.people p on p.id=a.person_id join public.sub_jobs j on j.id=a.sub_job_id join public.work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id where p_kind='dumping' and a.active
 ),filtered as (
 select * from queue where (p_start is null or date>=p_start::text) and (p_end is null or date<=p_end::text) and concat_ws(' ',id,person,order_id,title,description,job) ilike '%'||coalesce(p_search,'')||'%'
 ) select (select count(*) from filtered),coalesce((select jsonb_agg(to_jsonb(page) order by created_at,id) from (select * from filtered order by created_at,id limit 50 offset p_offset) page),'[]') into total,rows;
 return jsonb_build_object('total',total,'rows',rows);
end$$;
create function manufacturing_private.approve_barcodes(p_kind text,p_ids text[],p_request uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$declare ids text[];receipt public.barcode_approval_batches;b public.boxes;a public.dumping_assignments;j public.sub_jobs;oid text;changed integer:=0;skipped integer:=0;pieces integer:=0;result jsonb;begin
 perform manufacturing_private.require_admin_approvals();
 select array_agg(distinct x order by x) into ids from unnest(p_ids) x;
 if p_request is null or coalesce(cardinality(ids),0)<1 or cardinality(ids)>100 or p_kind is null or p_kind not in ('box','dumping') or length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>500 then raise exception 'Select 1–100 codes and enter an approval reason (3–500 characters)';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into receipt from public.barcode_approval_batches where id=p_request;
 if found then
  if receipt.actor_id<>auth.uid() or receipt.kind<>p_kind or receipt.ids<>ids or receipt.reason<>trim(p_reason) then raise exception 'Approval request reference already used';end if;
  return receipt.outcome||jsonb_build_object('duplicate',true);
 end if;
 if p_kind='box' then
  if exists(select 1 from unnest(ids) x where not exists(select 1 from public.boxes where id=x)) then raise exception 'One or more box codes no longer exist';end if;
  perform 1 from public.orders where id in (select w.order_id from public.boxes bx join public.sub_jobs sj on sj.id=bx.sub_job_id join public.work_orders w on w.id=sj.work_order_id where bx.id=any(ids)) order by id for update;
  for b in select * from public.boxes where id=any(ids) order by id for update loop
   if b.completed_at is not null then skipped:=skipped+1;continue;end if;
   select * into j from public.sub_jobs where id=b.sub_job_id for update;
   if j.completed+b.quantity>j.quantity then raise exception 'Box % exceeds the remaining sub-job quantity. No codes in this batch were changed.',b.id;end if;
   select order_id into oid from public.work_orders where id=j.work_order_id;
   update public.boxes set completed_pieces=quantity,completed_at=now() where id=b.id;
   update public.sub_jobs set completed=completed+b.quantity where id=j.id;
   update public.bookings set status='completed' where id=b.id;
   insert into public.production_records(box_id,completed_pieces,actor_id) values(b.id,b.quantity,auth.uid());
   update public.orders set revision=revision+1,updated_at=now() where id=oid;
   insert into public.order_events(order_id,actor_id,message) values(oid,auth.uid(),'Admin approved box '||b.id||' complete: '||b.quantity||' pieces. Reason: '||trim(p_reason));
   changed:=changed+1;pieces:=pieces+b.quantity;
  end loop;
 else
  if exists(select 1 from unnest(ids) x where not exists(select 1 from public.dumping_assignments where id=x)) then raise exception 'One or more reusable codes no longer exist';end if;
  perform 1 from public.orders where id in (select w.order_id from public.dumping_assignments da join public.sub_jobs sj on sj.id=da.sub_job_id join public.work_orders w on w.id=sj.work_order_id where da.id=any(ids)) order by id for update;
  for a in select * from public.dumping_assignments where id=any(ids) order by id for update loop
   if not a.active then skipped:=skipped+1;continue;end if;
   select w.order_id into oid from public.sub_jobs sj join public.work_orders w on w.id=sj.work_order_id where sj.id=a.sub_job_id;
   update public.dumping_assignments set active=false where id=a.id;
   update public.orders set revision=revision+1,updated_at=now() where id=oid;
   insert into public.order_events(order_id,actor_id,message) values(oid,auth.uid(),'Admin closed reusable QR '||a.id||'. No pieces added. Reason: '||trim(p_reason));
   changed:=changed+1;
  end loop;
 end if;
 result:=jsonb_build_object('changed',changed,'skipped',skipped,'pieces',pieces,'duplicate',false);
 insert into public.barcode_approval_batches(id,actor_id,kind,ids,reason,outcome) values(p_request,auth.uid(),p_kind,ids,trim(p_reason),result);
 return result;
end$$;
create function public.app_barcode_queue(p_kind text default 'box',p_start date default null,p_end date default null,p_search text default '',p_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.barcode_queue(p_kind,p_start,p_end,p_search,p_offset);$$;
create function public.app_approve_barcodes(p_kind text,p_ids text[],p_request uuid,p_reason text) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.approve_barcodes(p_kind,p_ids,p_request,p_reason);$$;
revoke all on function manufacturing_private.require_admin_approvals(),manufacturing_private.barcode_queue(text,date,date,text,integer),manufacturing_private.approve_barcodes(text,text[],uuid,text),public.app_barcode_queue(text,date,date,text,integer),public.app_approve_barcodes(text,text[],uuid,text) from public,anon;
grant execute on function manufacturing_private.require_admin_approvals(),manufacturing_private.barcode_queue(text,date,date,text,integer),manufacturing_private.approve_barcodes(text,text[],uuid,text),public.app_barcode_queue(text,date,date,text,integer),public.app_approve_barcodes(text,text[],uuid,text) to authenticated;
commit;
