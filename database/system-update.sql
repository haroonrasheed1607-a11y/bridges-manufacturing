begin;
create table public.system_update_state(
 id boolean primary key default true check(id),
 updating boolean not null default false,
 updated_at timestamptz not null default clock_timestamp()
);
insert into public.system_update_state(id,updating) values(true,false);
alter table public.system_update_state enable row level security;
revoke all on public.system_update_state from public,anon,authenticated,service_role;

create function manufacturing_private.system_available()
returns boolean language plpgsql security definer set search_path='' as $$
begin
 -- Keep the lock until the business request finishes. Enabling maintenance
 -- waits for in-flight database requests before the flag becomes visible.
 perform pg_advisory_xact_lock_shared(hashtextextended('bridges-system-update',0));
 if (select updating from public.system_update_state where id=true) then
  raise sqlstate 'PT503' using message='System under update, please wait';
 end if;
 return true;
end $$;
create schema manufacturing_maintenance;
revoke all on schema manufacturing_maintenance from public;
grant usage on schema manufacturing_maintenance to anon,authenticated,service_role;
create function manufacturing_maintenance.request_guard()
returns void language plpgsql security definer set search_path='' as $$
begin
 if current_setting('request.path',true)='/rpc/app_system_status' then return;end if;
 perform manufacturing_private.system_available();
end $$;
create function manufacturing_maintenance.system_status()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('updating',updating,'message','System under update, please wait')
 from public.system_update_state where id=true;
$$;
revoke all on function manufacturing_maintenance.request_guard(),manufacturing_maintenance.system_status() from public;
grant execute on function manufacturing_maintenance.request_guard(),manufacturing_maintenance.system_status() to anon,authenticated,service_role;
create function public.app_request_guard()
returns void language sql security invoker set search_path='' as $$
 select manufacturing_maintenance.request_guard();
$$;
create function public.app_system_status()
returns jsonb language sql stable security invoker set search_path='' as $$
 select manufacturing_maintenance.system_status();
$$;
create function manufacturing_private.set_system_update(p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_enabled is null then raise exception 'Specify true or false';end if;
 perform pg_advisory_xact_lock(hashtextextended('bridges-system-update',0));
 update public.system_update_state set updating=p_enabled,updated_at=clock_timestamp() where id=true;
end $$;
revoke all on function manufacturing_private.system_available(),public.app_request_guard(),public.app_system_status(),manufacturing_private.set_system_update(boolean) from public,anon,authenticated,service_role;
grant execute on function manufacturing_private.system_available(),public.app_request_guard(),public.app_system_status() to anon,authenticated,service_role;
-- The switch is deliberately operator-only: devices cannot turn it off.

create policy manufacturing_storage_update_guard on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'manufacturing-files' or (select manufacturing_private.system_available()))
 with check(bucket_id<>'manufacturing-files' or (select manufacturing_private.system_available()));

do $$declare prior text;begin
 select substr(setting,length('pgrst.db_pre_request=')+1) into prior
 from pg_roles r cross join lateral unnest(coalesce(r.rolconfig,'{}'::text[])) setting
 where r.rolname='authenticator' and setting like 'pgrst.db_pre_request=%';
 if coalesce(prior,'') not in ('','public.app_request_guard') then
  raise exception 'Existing API pre-request hook requires integration: %',prior;
 end if;
end $$;
alter role authenticator set pgrst.db_pre_request='public.app_request_guard';
notify pgrst,'reload config';
notify pgrst,'reload schema';
commit;
