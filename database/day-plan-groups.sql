alter table public.dumping_assignments add column if not exists plan_id uuid;

-- Keep the existing planning checks, role restrictions, locks, and scan path.
-- A null plan ID denotes the original single plan for a date and sub-job.
do $patch$
declare
 definition text;
 hook text;
 patches text[][]:=array[
   array['where sub_job_id=p_job and work_date=p_date and active','where sub_job_id=p_job and work_date=p_date and plan_id is not distinct from p_plan and active'],
   array['a.sub_job_id<>p_job','not (a.sub_job_id=p_job and a.plan_id is not distinct from p_plan)'],
   array['and sub_job_id<>p_job','and (sub_job_id<>p_job or plan_id is distinct from p_plan)'],
   array['batch_quantity,work_date,created_by)','batch_quantity,work_date,created_by,plan_id)'],
   array['w.pieces_per_pack,p_date,auth.uid()','w.pieces_per_pack,p_date,auth.uid(),p_plan'],
   array['''approvedAt'',a.plan_approved_at','''approvedAt'',a.plan_approved_at,''planId'',a.plan_id'],
   array['order by ord.id,sj.id,person.name,person.id','order by ord.id,sj.id,a.plan_id nulls first,person.name,person.id']
 ];
 patch text[];
begin
 if to_regprocedure('manufacturing_private.day_plan_group(date,text,text[],text[],uuid)') is null then
   definition:=pg_get_functiondef('manufacturing_private.day_plan(date,text,text[],text[])'::regprocedure);
   foreach patch slice 1 in array patches loop
     if position(patch[1] in definition)=0 then raise exception 'Unexpected day_plan definition: %',patch[1]; end if;
     definition:=replace(definition,patch[1],patch[2]);
   end loop;
   definition:='create function manufacturing_private.day_plan_group(p_date date,p_job text,p_people text[],p_expected text[],p_plan uuid)'||
     substring(definition from position(' RETURNS jsonb' in definition));
   execute definition;
 end if;

 if to_regprocedure('manufacturing_private.approve_day_plan_group(date,text,text[],uuid)') is null then
   definition:=pg_get_functiondef('manufacturing_private.approve_day_plan(date,text,text[])'::regprocedure);
   hook:='where sub_job_id=p_job and work_date=p_date and active';
   if position(hook in definition)=0 then raise exception 'Unexpected approve_day_plan definition'; end if;
   definition:=replace(definition,hook,'where sub_job_id=p_job and work_date=p_date and plan_id is not distinct from p_plan and active');
   definition:='create function manufacturing_private.approve_day_plan_group(p_date date,p_job text,p_expected text[],p_plan uuid)'||
     substring(definition from position(' RETURNS jsonb' in definition));
   execute definition;
 end if;
end
$patch$;

create or replace function manufacturing_private.day_plan(p_date date,p_job text default null,p_people text[] default null,p_expected text[] default null)
returns jsonb language sql security definer set search_path='' as $$
 select manufacturing_private.day_plan_group(p_date,p_job,p_people,p_expected,null);
$$;

create or replace function manufacturing_private.approve_day_plan(p_date date,p_job text,p_expected text[])
returns jsonb language sql security definer set search_path='' as $$
 select manufacturing_private.approve_day_plan_group(p_date,p_job,p_expected,null);
$$;

create or replace function public.app_move_day_plan(p_date date,p_job text,p_people text[],p_expected text[],p_plan uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.day_plan_group(p_date,p_job,p_people,p_expected,p_plan);
$$;

create or replace function public.app_approve_day_plan_group(p_date date,p_job text,p_expected text[],p_plan uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.approve_day_plan_group(p_date,p_job,p_expected,p_plan);
$$;

revoke all on function manufacturing_private.day_plan_group(date,text,text[],text[],uuid),
 manufacturing_private.approve_day_plan_group(date,text,text[],uuid),public.app_move_day_plan(date,text,text[],text[],uuid),
 public.app_approve_day_plan_group(date,text,text[],uuid) from public,anon;
grant execute on function manufacturing_private.day_plan_group(date,text,text[],text[],uuid),
 manufacturing_private.approve_day_plan_group(date,text,text[],uuid),public.app_move_day_plan(date,text,text[],text[],uuid),
 public.app_approve_day_plan_group(date,text,text[],uuid) to authenticated;
