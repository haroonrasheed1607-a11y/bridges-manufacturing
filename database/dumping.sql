begin;
create table public.dumping_assignments(
 id text primary key check(id ~ '^DUMP-[A-F0-9]{16}$'),sub_job_id text not null references public.sub_jobs(id),person_id text not null references public.people(id),
 batch_quantity integer not null check(batch_quantity between 1 and 1000000),active boolean not null default true,last_scan_at timestamptz,
 created_at timestamptz not null default now(),created_by uuid references auth.users(id)
);
create index dumping_job_idx on public.dumping_assignments(sub_job_id);
create index dumping_person_idx on public.dumping_assignments(person_id);
create index dumping_actor_idx on public.dumping_assignments(created_by);
create unique index dumping_active_person_job_idx on public.dumping_assignments(person_id,sub_job_id) where active;
create table public.dumping_completions(
 id uuid primary key,assignment_id text not null references public.dumping_assignments(id),pieces integer not null check(pieces>0),
 completed_at timestamptz not null default now(),actor_id uuid not null references auth.users(id)
);
create index dumping_completion_assignment_idx on public.dumping_completions(assignment_id,completed_at);
create index dumping_completion_actor_idx on public.dumping_completions(actor_id);
alter table public.dumping_assignments enable row level security;
alter table public.dumping_completions enable row level security;
revoke all on public.dumping_assignments,public.dumping_completions from public,anon,authenticated;
create function manufacturing_private.dumping_access(p_job text,p_setup boolean) returns void language plpgsql security definer set search_path='' as $$declare r text:=manufacturing_private.actor_role();w public.work_orders;begin
 if auth.uid() is null or r is null or (p_setup and r not in ('admin','manager','coach','station','box_setup')) or (not p_setup and r not in ('admin','manager','coach','station','box_scanner')) then raise exception 'Dumping access denied' using errcode='42501';end if;
 select wo.* into w from public.work_orders wo join public.sub_jobs j on j.work_order_id=wo.id where j.id=p_job;
 if w.id is null or not manufacturing_private.can_read_order(w.order_id) or (r='coach' and w.coach_id is distinct from (select person_id from public.staff_profiles where id=auth.uid())) then raise exception 'Work access denied' using errcode='42501';end if;
end$$;
create function manufacturing_private.dumping_list() returns jsonb language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or manufacturing_private.actor_role() is null then raise exception 'Staff access required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(x order by x->>'createdAt' desc) from (select jsonb_build_object('id',a.id,'jobId',a.sub_job_id,'workId',w.id,'orderId',o.id,'personId',a.person_id,'batchQuantity',a.batch_quantity,'active',a.active,'createdAt',a.created_at,'pieces',coalesce((select sum(pieces) from public.dumping_completions c where c.assignment_id=a.id),0)) x from public.dumping_assignments a join public.sub_jobs j on j.id=a.sub_job_id join public.work_orders w on w.id=j.work_order_id join public.orders o on o.id=w.order_id where manufacturing_private.can_read_order(o.id) and (manufacturing_private.actor_role()<>'coach' or w.coach_id=(select person_id from public.staff_profiles where id=auth.uid())) order by a.created_at desc limit 500) q),'[]');
end$$;
create function manufacturing_private.dumping_assign(p_id text,p_job text,p_person text,p_quantity integer) returns jsonb language plpgsql security definer set search_path='' as $$declare oid text;begin
 perform manufacturing_private.dumping_access(p_job,true);
 select w.order_id into oid from public.sub_jobs j join public.work_orders w on w.id=j.work_order_id where j.id=p_job;
 perform 1 from public.orders where id=oid and stage=1 for update;if not found then raise exception 'Order is not in production';end if;
 if not exists(select 1 from public.people where id=p_person and kind='individual' and coalesce(data->>'active','true')<>'false') then raise exception 'Select an active individual';end if;
 if not exists(select 1 from public.sub_jobs where id=p_job and completed<quantity) then raise exception 'Sub-job is already complete';end if;
 insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,created_by) values(p_id,p_job,p_person,p_quantity,auth.uid()) on conflict(id) do nothing;
 if not exists(select 1 from public.dumping_assignments where id=p_id and sub_job_id=p_job and person_id=p_person and batch_quantity=p_quantity and active) then raise exception 'Assignment reference already used';end if;
 return manufacturing_private.dumping_list();
end$$;
create function manufacturing_private.dumping_close(p_id text) returns jsonb language plpgsql security definer set search_path='' as $$declare a public.dumping_assignments;begin
 select * into a from public.dumping_assignments where id=p_id;
 perform manufacturing_private.dumping_access(a.sub_job_id,true);
 update public.dumping_assignments set active=false where id=p_id;return manufacturing_private.dumping_list();
end$$;
create function manufacturing_private.dumping_scan(p_id text,p_request uuid,p_pieces integer default null) returns jsonb language plpgsql security definer set search_path='' as $$declare a public.dumping_assignments;c public.dumping_completions;j public.sub_jobs;w public.work_orders;o public.orders;qty integer;pending integer;begin
 select * into a from public.dumping_assignments where id=upper(trim(p_id));
 if a.id is null then raise exception 'Reusable QR not found';end if;
 perform manufacturing_private.dumping_access(a.sub_job_id,false);
 select * into j from public.sub_jobs where id=a.sub_job_id;select * into w from public.work_orders where id=j.work_order_id;
 select * into o from public.orders where id=w.order_id for update;
 select * into a from public.dumping_assignments where id=a.id for update;
 select * into j from public.sub_jobs where id=a.sub_job_id for update;
 select * into c from public.dumping_completions where id=p_request;
 if c.id is not null then
  if c.assignment_id<>a.id or c.actor_id<>auth.uid() then raise exception 'Request reference already used';end if;
  return jsonb_build_object('duplicate',true,'pieces',c.pieces,'personId',a.person_id,'eventId',c.id);
 end if;
 if not a.active or o.stage<>1 then raise exception 'Assignment is closed or order is not in production';end if;
 if not exists(select 1 from public.people where id=a.person_id and coalesce(data->>'active','true')<>'false') then raise exception 'Individual is inactive';end if;
 if a.last_scan_at>clock_timestamp()-interval '5 seconds' then raise exception 'Duplicate scan blocked. Remove the QR and wait before scanning the next batch.';end if;
 qty:=coalesce(p_pieces,a.batch_quantity);
 select coalesce(sum(quantity),0) into pending from public.boxes where sub_job_id=j.id and completed_at is null;
 if qty is null or qty<1 or qty>a.batch_quantity or qty+j.completed+pending>j.quantity then raise exception 'Batch exceeds available pieces. Enter a smaller final batch if needed.';end if;
 insert into public.dumping_completions(id,assignment_id,pieces,actor_id) values(p_request,a.id,qty,auth.uid());
 update public.dumping_assignments set last_scan_at=clock_timestamp() where id=a.id;
 update public.sub_jobs set completed=completed+qty where id=j.id;
 update public.orders set revision=revision+1,updated_at=now() where id=o.id;
 insert into public.order_events(order_id,actor_id,message) values(o.id,auth.uid(),'Dumping '||a.id||': '||qty||' pieces completed.');
 return jsonb_build_object('duplicate',false,'pieces',qty,'personId',a.person_id,'eventId',p_request,'jobId',j.id,'completed',j.completed+qty);
end$$;
create function public.app_dumping_list() returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.dumping_list();$$;
create function public.app_dumping_assign(p_id text,p_job text,p_person text,p_quantity integer) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.dumping_assign(p_id,p_job,p_person,p_quantity);$$;
create function public.app_dumping_close(p_id text) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.dumping_close(p_id);$$;
create function public.app_dumping_scan(p_id text,p_request uuid,p_pieces integer default null) returns jsonb language sql security invoker set search_path='' as $$select manufacturing_private.dumping_scan(p_id,p_request,p_pieces);$$;
revoke all on function manufacturing_private.dumping_access(text,boolean),manufacturing_private.dumping_list(),manufacturing_private.dumping_assign(text,text,text,integer),manufacturing_private.dumping_close(text),manufacturing_private.dumping_scan(text,uuid,integer),public.app_dumping_list(),public.app_dumping_assign(text,text,text,integer),public.app_dumping_close(text),public.app_dumping_scan(text,uuid,integer) from public,anon;
grant execute on function manufacturing_private.dumping_access(text,boolean),manufacturing_private.dumping_list(),manufacturing_private.dumping_assign(text,text,text,integer),manufacturing_private.dumping_close(text),manufacturing_private.dumping_scan(text,uuid,integer),public.app_dumping_list(),public.app_dumping_assign(text,text,text,integer),public.app_dumping_close(text),public.app_dumping_scan(text,uuid,integer) to authenticated;
-- Keep generic order edits from erasing dumping completion totals.
do $$declare definition text;begin
 select pg_get_functiondef('manufacturing_private.save_order(jsonb,bigint,text)'::regprocedure) into definition;
 definition:=replace(definition,'j.completed<coalesce((select sum(completed_pieces) from public.boxes where sub_job_id=j.id),0)','j.completed<coalesce((select sum(completed_pieces) from public.boxes where sub_job_id=j.id),0)+coalesce((select sum(c.pieces) from public.dumping_completions c join public.dumping_assignments a on a.id=c.assignment_id where a.sub_job_id=j.id),0)');
 execute definition;
end$$;
commit;
