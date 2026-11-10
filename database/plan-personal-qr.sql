begin;

-- NULL preserves the QR behavior of plans created before the checkbox.
alter table public.dumping_assignments add column personal_qr boolean;

do $$
declare
  definition text;
  patch text[];
begin
  definition:=pg_get_functiondef('manufacturing_private.day_plan_group(date,text,text[],text[],uuid)'::regprocedure);
  foreach patch slice 1 in array array[
    array['current_people text[];','current_people text[]; plan_personal boolean; plan_load integer;'],
    array['if selected<>current_people then',$code$
   select a.personal_qr,a.batch_quantity into plan_personal,plan_load
     from public.dumping_assignments a where a.sub_job_id=p_job and a.work_date=p_date
       and a.plan_id is not distinct from p_plan and a.active order by a.id limit 1;
   if not found then
     plan_personal:=p_personal;
     plan_load:=coalesce(w.scan_pieces,w.pieces_per_pack);
   elsif p_personal is not null and plan_personal is distinct from p_personal then
     raise exception 'The QR method cannot change after a plan is saved';
   end if;
   if selected<>current_people then$code$],
    array['insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,work_date,created_by,plan_id)',$code$
     if plan_personal is true then
       update public.people set job_qr_code='IND-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16))
       where id=any(selected) and job_qr_code is null;
     end if;
     insert into public.dumping_assignments(id,sub_job_id,person_id,batch_quantity,work_date,created_by,plan_id,personal_qr)$code$],
    array['w.pieces_per_pack,p_date,auth.uid(),p_plan','case when plan_personal then plan_load else w.pieces_per_pack end,p_date,auth.uid(),p_plan,plan_personal'],
    array['''batchQuantity'',coalesce(wo.scan_pieces,a.batch_quantity)','''batchQuantity'',case when a.personal_qr then a.batch_quantity else coalesce(wo.scan_pieces,a.batch_quantity) end,''personalQr'',a.personal_qr']
  ] loop
    if position(patch[1] in definition)=0 then raise exception 'Unexpected plan definition: %',patch[1]; end if;
    definition:=replace(definition,patch[1],patch[2]);
  end loop;
  execute 'create function manufacturing_private.day_plan_group(p_date date,p_job text,p_people text[],p_expected text[],p_plan uuid,p_personal boolean)'
    ||substring(definition from position(' RETURNS jsonb' in definition));

  definition:=pg_get_functiondef('manufacturing_private.dumping_scan(text,uuid,integer)'::regprocedure);
  foreach patch slice 1 in array array[
    array['if a.work_date is not null then' || chr(10) || '   if a.work_date', $code$if a.personal_qr is true and not p_personal then
   raise exception 'Scan the individual’s own Job QR for this plan';
 end if;
 if a.work_date is not null then
   if a.work_date$code$],
    array['a.batch_quantity:=coalesce(w.scan_pieces,a.batch_quantity);',$code$
 if a.personal_qr is not true then a.batch_quantity:=coalesce(w.scan_pieces,a.batch_quantity); end if;
 select coalesce(sum(quantity),0) into pending from public.boxes where sub_job_id=j.id and completed_at is null;
 if a.personal_qr is true and p_pieces is distinct from least(a.batch_quantity,j.quantity-j.completed-pending) then
   raise exception 'The remaining pieces changed. Review the updated load and confirm again.' using errcode='40001';
 end if;$code$],
    array[chr(10)||' select coalesce(sum(quantity),0) into pending from public.boxes where sub_job_id=j.id and completed_at is null;'||chr(10)||' if qty',
          chr(10)||' if qty']
  ] loop
    if position(patch[1] in definition)=0 then raise exception 'Unexpected scanner definition: %',patch[1]; end if;
    definition:=replace(definition,patch[1],patch[2]);
  end loop;
  execute 'create function manufacturing_private.dumping_scan(p_id text,p_request uuid,p_pieces integer,p_personal boolean)'
    ||substring(definition from position(' RETURNS jsonb' in definition));

  definition:=pg_get_functiondef('manufacturing_private.resolve_individual_job_qr(text)'::regprocedure);
  if position('and a.active and a.plan_approved_at' in definition)=0 then raise exception 'Unexpected personal QR lookup'; end if;
  execute replace(definition,'and a.active and a.plan_approved_at','and a.active and a.personal_qr is distinct from false and a.plan_approved_at');

  definition:=pg_get_functiondef('manufacturing_private.approved_day_plans(date)'::regprocedure);
  if position('and label->>''approvedAt'' is not null' in definition)=0 then raise exception 'Unexpected print list'; end if;
  execute replace(definition,'and label->>''approvedAt'' is not null',
    'and label->>''approvedAt'' is not null and label->>''personalQr'' is distinct from ''true''');
end $$;

create or replace function manufacturing_private.day_plan_group(p_date date,p_job text,p_people text[],p_expected text[],p_plan uuid)
returns jsonb language sql security definer set search_path='' as $$
  select manufacturing_private.day_plan_group(p_date,p_job,p_people,p_expected,p_plan,null);
$$;

create function public.app_move_day_plan(p_date date,p_job text,p_people text[],p_expected text[],p_plan uuid,p_personal boolean)
returns jsonb language sql security invoker set search_path='' as $$
  select manufacturing_private.day_plan_group(p_date,p_job,p_people,p_expected,p_plan,p_personal);
$$;

create or replace function manufacturing_private.dumping_scan(p_id text,p_request uuid,p_pieces integer default null)
returns jsonb language sql security definer set search_path='' as $$
  select manufacturing_private.dumping_scan(p_id,p_request,p_pieces,false);
$$;

do $$
declare definition text;
begin
  definition:=pg_get_functiondef('manufacturing_private.individual_job_qr(text)'::regprocedure);
  if position('return manufacturing_private.reusable_barcode(assignment.id)||details;' in definition)=0 then
    raise exception 'Unexpected individual lookup';
  end if;
  execute replace(definition,'return manufacturing_private.reusable_barcode(assignment.id)||details;',$code$
  if assignment.personal_qr is true then
    details:=details||jsonb_build_object('personalQr',true,'batchQuantity',assignment.batch_quantity,
      'scanQuantity',(select greatest(0,least(assignment.batch_quantity,j.quantity-j.completed-coalesce((
        select sum(b.quantity) from public.boxes b where b.sub_job_id=j.id and b.completed_at is null
      ),0))) from public.sub_jobs j where j.id=assignment.sub_job_id));
  end if;
  return manufacturing_private.reusable_barcode(assignment.id)||details;$code$);

  definition:=pg_get_functiondef('manufacturing_private.scan_individual_job_qr(text,text,uuid,integer,integer)'::regprocedure);
  if position('return manufacturing_private.scan_reusable_configured' in definition)=0 then
    raise exception 'Unexpected individual scanner';
  end if;
  execute replace(definition,'return manufacturing_private.scan_reusable_configured',$code$
  if assignment.personal_qr is true then
    if assignment.batch_quantity is distinct from p_expected_load then
      raise exception 'Pieces per scan changed. Review the updated load and confirm again.' using errcode='40001';
    end if;
    return manufacturing_private.dumping_scan(assignment.id,p_request,p_pieces,true);
  end if;
  return manufacturing_private.scan_reusable_configured$code$);
end $$;

revoke all on function manufacturing_private.dumping_scan(text,uuid,integer,boolean) from public,anon,authenticated;
revoke all on function manufacturing_private.day_plan_group(date,text,text[],text[],uuid,boolean),
  public.app_move_day_plan(date,text,text[],text[],uuid,boolean) from public,anon;
grant execute on function manufacturing_private.day_plan_group(date,text,text[],text[],uuid,boolean),
  public.app_move_day_plan(date,text,text[],text[],uuid,boolean) to authenticated;

commit;
