begin;
-- Catalog metadata stays editable in Manufacturing; prices are Accounts-only.
do $$declare original text; definition text; hook text;begin
 original:=pg_get_functiondef('manufacturing_private.save_customer_item(uuid,text,text,text,numeric,text,integer,bigint)'::regprocedure);
 hook:=' begin'||chr(10)||'  if previous.id is null then';
 definition:=replace(original,hook,$guard$
 if (previous.id is null and p_rate is not null) or (previous.id is not null and p_rate is distinct from previous.rate) then
  raise exception 'Only Accounts users can change item rates' using errcode='42501';
 end if;
 $guard$||hook);
 if definition=original then raise exception 'Unexpected catalog save definition';end if;
 execute definition;
 original:=pg_get_functiondef('manufacturing_private.register_customer_item(text,text,text,numeric)'::regprocedure);
 hook:='perform manufacturing_private.require_manager();';
 definition:=replace(original,hook,hook||$guard$
 if p_rate is not null then raise exception 'Only Accounts users can set item rates' using errcode='42501';end if;
 $guard$);
 if definition=original then raise exception 'Unexpected registration definition';end if;
 execute definition;
 original:=pg_get_functiondef('manufacturing_private.save_order(jsonb,bigint,text)'::regprocedure);
 hook:='expected_stage:=(p_order->>''stage'')::integer;';
 definition:=replace(original,hook,$guard$
 if old.id is not null and p_order->'catalogRate' is distinct from old.data->'catalogRate' then
  raise exception 'Order rates are locked. Item rates are managed in Accounts.' using errcode='42501';
 end if;
 $guard$||hook);
 if definition=original then raise exception 'Unexpected order rate snapshot';end if;
 execute definition;
end $$;

create table public.catalog_rate_changes(
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.customer_items(id),
 actor_id uuid not null references auth.users(id),
 previous_rate numeric,
 new_rate numeric,
 changed_at timestamptz not null default clock_timestamp()
);
create index catalog_rate_changes_item_idx on public.catalog_rate_changes(item_id);
create index catalog_rate_changes_actor_idx on public.catalog_rate_changes(actor_id);
alter table public.catalog_rate_changes enable row level security;
revoke all on public.catalog_rate_changes from public,anon,authenticated;

create function manufacturing_private.accounts_item_catalog()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or manufacturing_private.actor_role() is distinct from 'accounts' then raise exception 'Accounts access required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'items',coalesce((
  select jsonb_agg(jsonb_build_object('id',i.id,'code',i.code,'name',i.name,'rate',i.rate,'unit',i.unit,'piecesPerUnit',i.pieces_per_unit,'revision',i.revision) order by i.name,i.code)
  from public.customer_items i where i.customer_id=c.id),'[]'::jsonb)) order by c.name) from public.customers c),'[]'::jsonb);
end $$;
create function manufacturing_private.accounts_save_item_rate(p_item uuid,p_rate numeric,p_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.customer_items;
begin
 if auth.uid() is null or manufacturing_private.actor_role() is distinct from 'accounts' then raise exception 'Only Accounts users can change item rates' using errcode='42501';end if;
 if p_rate is not null and not(p_rate>=0 and p_rate<1000000000) then raise exception 'Enter a valid nonnegative rate';end if;
 perform pg_advisory_xact_lock(hashtextextended('customer-item:'||p_item::text,0));
 select * into item from public.customer_items where id=p_item for update;
 if item.id is null then raise exception 'Select an existing catalog item';end if;
 if p_revision is distinct from item.revision then raise exception 'This item changed. Refresh and review the latest rate.' using errcode='40001';end if;
 if p_rate is distinct from item.rate then
  update public.customer_items set rate=p_rate,revision=revision+1 where id=p_item;
  insert into public.catalog_rate_changes(item_id,actor_id,previous_rate,new_rate) values(item.id,auth.uid(),item.rate,p_rate);
 end if;
 return manufacturing_private.accounts_item_catalog();
end $$;
create function public.app_accounts_item_catalog()
returns jsonb language sql stable security invoker set search_path='' as $$ select manufacturing_private.accounts_item_catalog(); $$;
create function public.app_accounts_save_item_rate(p_item uuid,p_rate numeric,p_revision bigint)
returns jsonb language sql security invoker set search_path='' as $$ select manufacturing_private.accounts_save_item_rate(p_item,p_rate,p_revision); $$;
revoke all on function manufacturing_private.accounts_item_catalog(),public.app_accounts_item_catalog(),
 manufacturing_private.accounts_save_item_rate(uuid,numeric,bigint),public.app_accounts_save_item_rate(uuid,numeric,bigint) from public,anon;
grant execute on function manufacturing_private.accounts_item_catalog(),public.app_accounts_item_catalog(),
 manufacturing_private.accounts_save_item_rate(uuid,numeric,bigint),public.app_accounts_save_item_rate(uuid,numeric,bigint) to authenticated;
commit;
