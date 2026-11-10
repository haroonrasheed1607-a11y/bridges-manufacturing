-- Called by the existing order read and save routines. The save routine holds
-- the order row lock and validates the revision before replacing any sub-jobs.
create or replace function manufacturing_private.work_order_has_scans(p_work text)
returns boolean language sql stable set search_path='' as $$
 select exists (
   select 1 from public.sub_jobs j join public.boxes b on b.sub_job_id=j.id
   where j.work_order_id=p_work and (b.completed_at is not null or exists (
     select 1 from public.production_records r where r.box_id=b.id
   ))
 ) or exists (
   select 1 from public.sub_jobs j
   join public.dumping_assignments a on a.sub_job_id=j.id
   join public.dumping_completions c on c.assignment_id=a.id
   where j.work_order_id=p_work
 );
$$;

create or replace function manufacturing_private.replace_unstarted_sub_jobs(
 p_work text, p_stage integer, p_jobs jsonb, p_replace boolean
) returns void language plpgsql set search_path='' as $$
declare old_jobs text[];
begin
 select array_agg(id) into old_jobs from public.sub_jobs where work_order_id=p_work;
 if old_jobs is null or not exists (
   select 1 from unnest(old_jobs) old_job(id) where not exists (
     select 1 from jsonb_array_elements(p_jobs) new_job where new_job->>'id'=old_job.id
   )
 ) then return; end if;

 if p_replace is not true then
   raise exception 'Confirm sub-job replacement before removing the existing split';
 end if;
 if p_stage not in (0,1) or manufacturing_private.work_order_has_scans(p_work)
   or exists (select 1 from public.sub_jobs where id=any(old_jobs) and completed>0)
 then raise exception 'Sub-jobs cannot be replaced after production progress has been recorded'; end if;

 if jsonb_array_length(p_jobs)=0 or exists (
   select 1 from jsonb_array_elements(p_jobs) new_job
   where nullif(new_job->>'id','') is null or (new_job->>'id')=any(old_jobs)
     or coalesce((new_job->>'completed')::integer,0)<>0
 ) or (select count(distinct new_job->>'id') from jsonb_array_elements(p_jobs) new_job)
   <> jsonb_array_length(p_jobs)
 then raise exception 'Replace the entire split with new, unstarted sub-jobs'; end if;

 -- Scan history was checked under the order lock. Any printed labels attached
 -- to the old sub-jobs must become unusable before the new split is published.
 delete from public.boxes where sub_job_id=any(old_jobs);
 delete from public.dumping_assignments where sub_job_id=any(old_jobs);
 delete from public.sub_jobs where id=any(old_jobs);
end;
$$;

revoke all on function manufacturing_private.work_order_has_scans(text),
 manufacturing_private.replace_unstarted_sub_jobs(text,integer,jsonb,boolean) from public,anon,authenticated;

do $patch$
declare
 definition text;
 save_hook text:='insert into public.work_orders(id,order_id,coach_id,quantity,pieces_per_pack,data)';
 read_hook text:='''quantity'',w.quantity,''perPack'',w.pieces_per_pack,';
begin
 definition:=pg_get_functiondef('manufacturing_private.save_order(jsonb,bigint,text)'::regprocedure);
 if position('manufacturing_private.replace_unstarted_sub_jobs(' in definition)=0 then
   if position(save_hook in definition)=0 then raise exception 'Unexpected save_order definition'; end if;
   definition:=replace(definition,save_hook,
     'perform manufacturing_private.replace_unstarted_sub_jobs(w->>''id'',expected_stage,coalesce(w->''jobs'',''[]''),w->''replaceSubJobs''=''true''::jsonb);'||chr(10)||'  '||save_hook);
   definition:=replace(definition, 'w-''jobs''-''boxes''-''audits''-''packing''',
     'w-''jobs''-''boxes''-''audits''-''packing''-''hasScans''-''replaceSubJobs''');
   execute definition;
 end if;

 definition:=pg_get_functiondef('manufacturing_private.read_order(text)'::regprocedure);
 if position('manufacturing_private.work_order_has_scans(' in definition)=0 then
   if position(read_hook in definition)=0 then raise exception 'Unexpected read_order definition'; end if;
   definition:=replace(definition,read_hook,
     read_hook||'''hasScans'',case when r in (''admin'',''manager'') then manufacturing_private.work_order_has_scans(w.id) else false end,');
   execute definition;
 end if;
end
$patch$;
