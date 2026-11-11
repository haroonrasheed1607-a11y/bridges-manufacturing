begin;
alter table public.people
  add column job_qr_generated_at timestamptz,
  add column job_qr_expires_on date check(job_qr_expires_on is null or isfinite(job_qr_expires_on));

create function manufacturing_private.stamp_individual_qr()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.job_qr_code is not null and (tg_op='INSERT' or new.job_qr_code is distinct from old.job_qr_code) then
    new.job_qr_generated_at:=clock_timestamp();
  end if;
  return new;
end $$;
revoke all on function manufacturing_private.stamp_individual_qr() from public,anon,authenticated;
create trigger stamp_individual_qr before insert or update of job_qr_code on public.people
for each row execute function manufacturing_private.stamp_individual_qr();

create function manufacturing_private.individual_qr_cards(p_people text[],p_issue boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare selected text[];
begin
  perform manufacturing_private.require_manager();
  if p_people is null or cardinality(p_people) not between 1 and 100 or array_position(p_people,null) is not null or p_issue is null then
    raise exception 'Choose between 1 and 100 individuals';
  end if;
  select array_agg(distinct id order by id) into selected from unnest(p_people) id;
  perform 1 from public.people where id=any(selected) order by id for update;
  if (select count(*) from public.people where id=any(selected) and kind='individual')<>cardinality(selected) then
    raise exception 'Select registered individuals';
  end if;
  if p_issue then
    if exists(select 1 from public.people where id=any(selected) and (data->>'active'='false'
      or job_qr_expires_on<(clock_timestamp() at time zone 'America/Chicago')::date)) then
      raise exception 'Enable the individual and review their QR expiry before printing';
    end if;
    update public.people set job_qr_code='IND-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16))
    where id=any(selected) and job_qr_code is null;
  end if;
  return (select jsonb_agg(jsonb_build_object(
    'id',id,'name',name,'number',data->>'sourceNumber','code',job_qr_code,
    'generatedOn',(job_qr_generated_at at time zone 'America/Chicago')::date,
    'expiresOn',job_qr_expires_on,'active',data->>'active' is distinct from 'false'
  ) order by name,id) from public.people where id=any(selected));
end $$;

create function manufacturing_private.set_individual_qr_expiry(p_person text,p_expiry date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old_expiry date;
begin
  perform manufacturing_private.require_manager();
  if p_expiry is not null and not isfinite(p_expiry) then raise exception 'Choose a valid expiry date'; end if;
  select job_qr_expires_on into old_expiry from public.people where id=p_person and kind='individual' for update;
  if not found then raise exception 'Select a registered individual'; end if;
  update public.people set job_qr_expires_on=p_expiry where id=p_person;
  if old_expiry is distinct from p_expiry then
    insert into public.workforce_changes(kind,person_id,actor_id,data)
    values('individual_qr_expiry',p_person,auth.uid(),jsonb_build_object('previousExpiry',old_expiry,'expiresOn',p_expiry));
  end if;
  return manufacturing_private.individual_qr_cards(array[p_person],false)->0;
end $$;

create function public.app_individual_qr_cards(p_people text[],p_issue boolean default false)
returns jsonb language sql security invoker set search_path='' as $$
  select manufacturing_private.individual_qr_cards(p_people,p_issue);
$$;
create function public.app_set_individual_qr_expiry(p_person text,p_expiry date)
returns jsonb language sql security invoker set search_path='' as $$
  select manufacturing_private.set_individual_qr_expiry(p_person,p_expiry);
$$;

do $$
declare definition text:=pg_get_functiondef('manufacturing_private.resolve_individual_job_qr(text)'::regprocedure);
begin
  if position('where p.job_qr_code=' in definition)=0 then raise exception 'Unexpected personal QR resolver'; end if;
  execute replace(definition,'select a.* into assignment',$expiry$
  if exists(select 1 from public.people p where p.job_qr_code=upper(trim(p_code))
    and p.job_qr_expires_on<(clock_timestamp() at time zone 'America/Chicago')::date) then
    raise exception 'This Individual Job QR has expired. Ask a manager to renew it.';
  end if;
  select a.* into assignment$expiry$);
  definition:=pg_get_functiondef('manufacturing_private.scan_individual_job_qr(text,text,uuid,integer,integer)'::regprocedure);
  if position('assignment:=manufacturing_private.resolve_individual_job_qr(p_code);' in definition)=0 then
    raise exception 'Unexpected personal QR scanner';
  end if;
  execute replace(definition,'assignment:=manufacturing_private.resolve_individual_job_qr(p_code);',$lock$
  perform 1 from public.people where job_qr_code=upper(trim(p_code)) for update;
  assignment:=manufacturing_private.resolve_individual_job_qr(p_code);$lock$);
end $$;

revoke all on function manufacturing_private.individual_qr_cards(text[],boolean),
  public.app_individual_qr_cards(text[],boolean),manufacturing_private.set_individual_qr_expiry(text,date),
  public.app_set_individual_qr_expiry(text,date) from public,anon;
grant execute on function manufacturing_private.individual_qr_cards(text[],boolean),
  public.app_individual_qr_cards(text[],boolean),manufacturing_private.set_individual_qr_expiry(text,date),
  public.app_set_individual_qr_expiry(text,date) to authenticated;
commit;
