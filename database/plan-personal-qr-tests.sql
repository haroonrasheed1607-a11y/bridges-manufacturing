begin;
do $$
declare
  planner uuid;
  scanner uuid;
  prefix text:='TEST-PERSONAL-PLAN-'||gen_random_uuid();
  person text:=prefix||'-PERSON';
  sticker_person text:=prefix||'-STICKER-PERSON';
  work_date date:=(clock_timestamp() at time zone 'America/Chicago')::date;
  personal_plan uuid:=gen_random_uuid();
  sticker_plan uuid:=gen_random_uuid();
  scan_id uuid:=gen_random_uuid();
  own_qr text;
  sticker_person_qr text;
  personal_assignment text;
  sticker_assignment text;
  result jsonb;
begin
  select id into strict planner from public.staff_profiles where active and role='admin' limit 1;
  select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
  perform set_config('request.jwt.claim.sub',planner::text,true);
  insert into public.people(id,name,kind) values
    (person,'Rollback personal plan fixture','individual'),
    (sticker_person,'Rollback sticker plan fixture','individual');
  insert into public.orders(id,customer_id,stage,data)
    values(prefix,(select id from public.customers limit 1),1,'{"title":"Rollback personal plan fixture"}');
  insert into public.work_orders(id,order_id,quantity,pieces_per_pack,scan_pieces,scan_cooldown_seconds)
    values(prefix||'-W',prefix,200,25,40,0);
  insert into public.sub_jobs(id,work_order_id,quantity) values
    (prefix||'-J1',prefix||'-W',55),(prefix||'-J2',prefix||'-W',145);
  result:=public.app_move_day_plan(work_date,prefix||'-J1',array[person],'{}',personal_plan,true);
  select row->>'id' into strict personal_assignment from jsonb_array_elements(result) row
    where row @> jsonb_build_object('personId',person,'personalQr',true,'batchQuantity',40);
  select job_qr_code into strict own_qr from public.people where id=person;
  if own_qr is null then raise exception 'Missing automatically issued Job QR'; end if;
  perform public.app_approve_day_plan_group(work_date,prefix||'-J1',array[personal_assignment],personal_plan);

  sticker_person_qr:=public.app_issue_individual_job_qr(sticker_person);
  result:=public.app_move_day_plan(work_date,prefix||'-J2',array[sticker_person],'{}',sticker_plan,false);
  select row->>'id' into strict sticker_assignment from jsonb_array_elements(result) row
    where row @> jsonb_build_object('personId',sticker_person,'personalQr',false);
  perform public.app_approve_day_plan_group(work_date,prefix||'-J2',array[sticker_assignment],sticker_plan);
  result:=public.app_approved_day_plans(work_date);
  if result @> jsonb_build_array(jsonb_build_object('id',personal_assignment))
    or not result @> jsonb_build_array(jsonb_build_object('id',sticker_assignment)) then
    raise exception 'Incorrect sticker print queue';
  end if;

  update public.work_orders set scan_pieces=30 where id=prefix||'-W';
  perform set_config('request.jwt.claim.sub',scanner::text,true);
  begin
    perform public.app_individual_job_qr(sticker_person_qr);
    raise exception 'Sticker-only plan accepted a personal card';
  exception when raise_exception then
    if sqlerrm not like '%no approved, unfinished plan%' then raise; end if;
  end;
  begin
    perform public.app_scan_reusable_configured(personal_assignment,gen_random_uuid(),40,null);
    raise exception 'Personal plan accepted a sticker scan';
  exception when raise_exception then
    if sqlerrm not like 'Scan the individual%' then raise; end if;
  end;
  if not public.app_individual_job_qr(own_qr) @> '{"personalQr":true,"batchQuantity":40,"scanQuantity":40}' then
    raise exception 'Saved personal scan quantity was not retained';
  end if;
  begin
    perform public.app_scan_individual_job_qr(own_qr,personal_assignment,gen_random_uuid(),80,40);
    raise exception 'Personal scan accepted a double load';
  exception when serialization_failure then null;
  end;
  if not public.app_scan_individual_job_qr(own_qr,personal_assignment,scan_id,40,40) @> '{"pieces":40,"duplicate":false}' then
    raise exception 'Planned scan did not credit 40 pieces';
  end if;
  if not public.app_individual_job_qr(own_qr) @> '{"batchQuantity":40,"scanQuantity":15}' then
    raise exception 'Final load does not show remaining 15 pieces';
  end if;
  if not public.app_scan_individual_job_qr(own_qr,personal_assignment,gen_random_uuid(),15,40) @> '{"pieces":15,"duplicate":false}' then
    raise exception 'Final scan did not credit 15 pieces';
  end if;
  if not public.app_scan_individual_job_qr(own_qr,personal_assignment,scan_id,40,40) @> '{"pieces":40,"duplicate":true}' then
    raise exception 'Retry after completion did not return the original receipt';
  end if;
end $$;
rollback;
