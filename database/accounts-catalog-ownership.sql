begin;
do $$declare original text; definition text; hook text;begin
 original:=pg_get_functiondef('manufacturing_private.save_customer_item(uuid,text,text,text,numeric,text,integer,bigint)'::regprocedure);
 definition:=replace(original,'perform manufacturing_private.require_manager();',
  'if manufacturing_private.actor_role() is distinct from ''accounts'' then perform manufacturing_private.require_manager();end if;');
 hook:='if (previous.id is null and p_rate is not null) or (previous.id is not null and p_rate is distinct from previous.rate) then';
 if position(hook in definition)=0 then raise exception 'Unexpected existing rate guard';end if;
 definition:=replace(definition,hook,$guard$
 if manufacturing_private.actor_role() is distinct from 'accounts' and
   (previous.id is null or trim(p_code) is distinct from previous.code or trim(p_name) is distinct from previous.name) then
  raise exception 'Only Accounts users can add items or change codes and names' using errcode='42501';
 end if;
 if manufacturing_private.actor_role() is distinct from 'accounts' and
   ((previous.id is null and p_rate is not null) or (previous.id is not null and p_rate is distinct from previous.rate)) then
 $guard$);
 hook:='return manufacturing_private.workspace();';
 if position(hook in definition)=0 then raise exception 'Unexpected catalog return';end if;
 definition:=replace(definition,hook,$finish$
 if manufacturing_private.actor_role()='accounts' then
  if p_rate is distinct from previous.rate then
   insert into public.catalog_rate_changes(item_id,actor_id,previous_rate,new_rate) values(p_item,auth.uid(),previous.rate,p_rate);
  end if;
  return manufacturing_private.accounts_item_catalog();
 end if;
 return manufacturing_private.workspace();
 $finish$);
 if definition=original then raise exception 'Catalog ownership was not updated';end if;
 execute definition;
end $$;

create or replace function manufacturing_private.register_customer_item(p_customer text,p_code text,p_name text,p_rate numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 raise exception 'Register items through the Accounts client item catalog' using errcode='42501';
end $$;
create or replace function manufacturing_private.save_customer(p_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n text:=trim(regexp_replace(coalesce(p_name,''),'\s+',' ','g'));
begin
 if auth.uid() is null or manufacturing_private.actor_role() is distinct from 'accounts' then
  raise exception 'Only Accounts users can register clients' using errcode='42501';
 end if;
 if length(n) not between 1 and 200 then raise exception 'Enter a client name (up to 200 characters)';end if;
 insert into public.customers(id,name) values('CUS-'||gen_random_uuid()::text,n)
 on conflict(lower(trim(name))) do nothing;
 if not found then raise exception 'This client already exists';end if;
 return manufacturing_private.accounts_item_catalog();
end $$;
commit;
