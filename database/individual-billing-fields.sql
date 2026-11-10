begin;

create or replace function manufacturing_private.set_individual_billing_fields()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.kind <> 'individual' then
    return new;
  end if;

  new.data:='{"services":"waiver","billing":"piece","averageWorkingHours":3.5}'::jsonb||new.data;
  if coalesce(new.data->>'services','') not in ('waiver','state') then
    raise exception 'Choose Waiver or State for Services' using errcode='22023';
  end if;
  if coalesce(new.data->>'billing','') not in ('hourly','piece','both') then
    raise exception 'Choose Hourly, By piece, or Both for Billing' using errcode='22023';
  end if;
  if jsonb_typeof(new.data->'averageWorkingHours') is distinct from 'number' then
    raise exception 'Enter average working hours between 0 and 24' using errcode='22023';
  end if;
  if (new.data->>'averageWorkingHours')::numeric not between 0 and 24 then
    raise exception 'Enter average working hours between 0 and 24' using errcode='22023';
  end if;
  return new;
end;
$$;

revoke all on function manufacturing_private.set_individual_billing_fields() from public,anon,authenticated;

create trigger individual_billing_fields
before insert or update of kind,data on public.people
for each row execute function manufacturing_private.set_individual_billing_fields();

update public.people set data=data where kind='individual'
  and not (data ?& array['services','billing','averageWorkingHours']);

-- Merge the submitted fields on update. An upsert's EXCLUDED row also contains
-- defaults injected by the insert trigger, which could overwrite saved settings.
do $$
declare
  definition text:=pg_get_functiondef('manufacturing_private.save_person(jsonb)'::regprocedure);
  hook text:='data=people.data||excluded.data';
begin
  if position(hook in definition)=0 then
    raise exception 'Unexpected individual save function';
  end if;
  execute replace(definition,hook,$merge$data=people.data||(p_person-'active')$merge$);
end $$;

-- The shared workspace also serves shop-floor accounts.
do $$
declare
  definition text:=pg_get_functiondef('manufacturing_private.workspace()'::regprocedure);
  hook text:='jsonb_agg(p.data||jsonb_build_object';
begin
  if position(hook in definition)=0 then
    raise exception 'Unexpected workforce projection';
  end if;
  execute replace(definition,hook,
    $projection$jsonb_agg((case when r in ('admin','manager') and p.kind='individual' then p.data
      else p.data-array['services','billing','averageWorkingHours'] end)||jsonb_build_object$projection$);
end $$;

commit;
