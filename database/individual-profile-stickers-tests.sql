begin;
do $$
declare
  actor uuid;
  scanner uuid;
  pid text:='TEST-PROFILE-'||gen_random_uuid();
  second_id text:=pid||'-2';
  rows jsonb;
  code text;
  generated text;
  assignment_id text;
  plan uuid:=gen_random_uuid();
  today date:=(clock_timestamp() at time zone 'America/Chicago')::date;
begin
  select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
  select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public.people(id,name,kind) values
    (pid,'Rollback profile fixture','individual'),(second_id,'Rollback bulk fixture','individual');
  rows:=public.app_individual_qr_cards(array[pid,second_id],true);
  if jsonb_array_length(rows)<>2 or exists(
    select 1 from jsonb_array_elements(rows) row where row->>'code' is null or row->>'generatedOn' is null
  ) then raise exception 'Bulk QR generation missing metadata'; end if;
  select row->>'code',row->>'generatedOn' into code,generated from jsonb_array_elements(rows) row where row->>'id'=pid;
  rows:=public.app_individual_qr_cards(array[pid],true);
  if rows->0->>'code' is distinct from code or rows->0->>'generatedOn' is distinct from generated then
    raise exception 'Reprinting changed the QR metadata';
  end if;
  insert into public.orders(id,customer_id,stage,data)
    values(pid,(select id from public.customers limit 1),1,'{"title":"Rollback expiry fixture"}');
  insert into public.work_orders(id,order_id,quantity,pieces_per_pack,scan_pieces,scan_cooldown_seconds)
    values(pid,pid,100,25,25,0);
  insert into public.sub_jobs(id,work_order_id,quantity) values(pid,pid,100);
  rows:=public.app_move_day_plan(today,pid,array[pid],'{}',plan,true);
  select row->>'id' into strict assignment_id from jsonb_array_elements(rows) row where row->>'personId'=pid;
  perform public.app_approve_day_plan_group(today,pid,array[assignment_id],plan);
  perform public.app_set_individual_qr_expiry(pid,today-1);
  begin
    perform public.app_individual_qr_cards(array[pid,second_id],true);
    raise exception 'Expired QR could be printed';
  exception when raise_exception then
    if sqlerrm not like 'Enable the individual%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',scanner::text,true);
  begin
    perform public.app_scan_individual_job_qr(code,assignment_id,gen_random_uuid(),25,25);
    raise exception 'Expired personal QR could be scanned';
  exception when raise_exception then
    if sqlerrm not like '%QR has expired%' then raise; end if;
  end;
  begin
    perform public.app_individual_qr_cards(array[pid],false);
    raise exception 'Scanner opened profile print access';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform public.app_set_individual_qr_expiry(pid,today);
  rows:=public.app_individual_qr_cards(array[pid],true);
  if rows->0->>'code' is distinct from code then raise exception 'Renewal replaced the QR'; end if;
  perform set_config('request.jwt.claim.sub',scanner::text,true);
  if not public.app_scan_individual_job_qr(code,assignment_id,gen_random_uuid(),25,25) @> '{"pieces":25}' then
    raise exception 'QR was rejected on its valid expiry day';
  end if;
end $$;
rollback;
