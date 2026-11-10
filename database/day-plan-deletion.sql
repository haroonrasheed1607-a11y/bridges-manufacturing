-- Include inactive assignments when checking for scans. Removing an individual
-- from a plan must not erase the scan history for that plan.
create or replace function manufacturing_private.day_plan_has_scans(
 p_job text,p_date date,p_plan uuid
) returns boolean language sql stable set search_path='' as $$
 select exists (
   select 1 from public.dumping_assignments a
   join public.dumping_completions c on c.assignment_id=a.id
   where a.sub_job_id=p_job and a.work_date=p_date and a.plan_id is not distinct from p_plan
 );
$$;
revoke all on function manufacturing_private.day_plan_has_scans(text,date,uuid) from public,anon,authenticated;

do $patch$
declare
 definition text:=pg_get_functiondef('manufacturing_private.day_plan_group(date,text,text[],text[],uuid)'::regprocedure);
 write_hook text:='if selected<>current_people then';
 read_hook text:='''planId'',a.plan_id';
begin
 if position('manufacturing_private.day_plan_has_scans(' in definition)=0 then
   if position(write_hook in definition)=0 or position(read_hook in definition)=0 then
     raise exception 'Unexpected day_plan_group definition';
   end if;
   -- The existing group save already holds the order row lock used by scanning.
   definition:=replace(definition,write_hook,write_hook||chr(10)||
     '     if cardinality(selected)=0 and manufacturing_private.day_plan_has_scans(p_job,p_date,p_plan) then'||
     chr(10)||'       raise exception ''This plan cannot be deleted because scans have been recorded.'';'||
     chr(10)||'     end if;');
   definition:=replace(definition,read_hook,read_hook||
     ',''hasScans'',manufacturing_private.day_plan_has_scans(sj.id,a.work_date,a.plan_id)');
   execute definition;
 end if;
end
$patch$;
