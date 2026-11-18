create or replace function manufacturing_private.save_customer(p_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  client_name text := trim(regexp_replace(coalesce(p_name,''),'\s+',' ','g'));
  role text := manufacturing_private.actor_role();
begin
  if auth.uid() is null or role is null or role not in ('accounts','admin') then
    raise exception 'Only Accounts users and administrators can register clients' using errcode='42501';
  end if;
  if length(client_name) not between 1 and 200 then
    raise exception 'Enter a client name (up to 200 characters)';
  end if;
  insert into public.customers(id,name) values('CUS-'||gen_random_uuid()::text,client_name)
  on conflict(lower(trim(name))) do nothing;
  if not found then raise exception 'This client already exists'; end if;
  if role='accounts' then return manufacturing_private.accounts_item_catalog(); end if;
  return manufacturing_private.workspace();
end $$;
