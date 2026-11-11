begin;
alter table public.customer_items
 add column unit text not null default 'Item' check(unit in ('Item','Pack','Box')),
 add column pieces_per_unit integer not null default 1 check(pieces_per_unit between 1 and 1000000),
 add column revision bigint not null default 1 check(revision>0),
 add constraint customer_items_item_quantity check(unit<>'Item' or pieces_per_unit=1);
-- Existing planning used the saved pack quantity, or 25 when none was saved.
-- Preserve that quantity; staff can distinguish Pack from Box using Edit.
update public.customer_items set
 unit=case when coalesce((production_defaults->>'perPack')::integer,25)>1 then 'Pack' else 'Item' end,
 pieces_per_unit=coalesce((production_defaults->>'perPack')::integer,25);
create function manufacturing_private.sync_customer_item_unit()
returns trigger language plpgsql set search_path='' as $$
begin
 new.production_defaults:=new.production_defaults||jsonb_build_object('perPack',new.pieces_per_unit);
 return new;
end $$;
revoke all on function manufacturing_private.sync_customer_item_unit() from public,anon,authenticated;
create trigger customer_item_unit_defaults before insert or update on public.customer_items
for each row execute function manufacturing_private.sync_customer_item_unit();
update public.customer_items set production_defaults=production_defaults;

create function manufacturing_private.save_customer_item(
 p_item uuid,p_customer text,p_code text,p_name text,p_rate numeric,p_unit text,p_pieces_per_unit integer,p_revision bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.customer_items; quantity integer;
begin
 perform manufacturing_private.require_manager();
 if p_item is null or p_revision is null or p_revision<0 then raise exception 'Select a valid catalog item';end if;
 if not exists(select 1 from public.customers where id=p_customer) then raise exception 'Select a registered client';end if;
 if coalesce(length(trim(p_code)),0) not between 1 and 80 or coalesce(length(trim(p_name)),0) not between 1 and 180 then
  raise exception 'Enter an item code and item name';
 end if;
 if p_rate is not null and not(p_rate>=0 and p_rate<1000000000) then raise exception 'Enter a valid nonnegative rate';end if;
 if p_unit is null or p_unit not in ('Item','Pack','Box') then raise exception 'Select Item, Pack or Box';end if;
 quantity:=case when p_unit='Item' then 1 else p_pieces_per_unit end;
 if quantity is null or quantity not between 1 and 1000000 then raise exception 'Enter 1–1,000,000 pieces per pack or box';end if;
 perform pg_advisory_xact_lock(hashtextextended('customer-item:'||p_item::text,0));
 select * into previous from public.customer_items where id=p_item for update;
 if previous.id is not null and previous.customer_id<>p_customer then raise exception 'This item belongs to another client';end if;
 if (previous.id is null and p_revision<>0) or (previous.id is not null and previous.revision<>p_revision) then
  raise exception 'This item changed. Close the form and reopen Edit to review the latest values.' using errcode='40001';
 end if;
 begin
  if previous.id is null then
   insert into public.customer_items(id,customer_id,code,name,rate,unit,pieces_per_unit)
   values(p_item,p_customer,trim(p_code),trim(p_name),p_rate,p_unit,quantity);
  else
   update public.customer_items set code=trim(p_code),name=trim(p_name),rate=p_rate,unit=p_unit,
    pieces_per_unit=quantity,revision=revision+1 where id=p_item;
  end if;
 exception when unique_violation then raise exception 'That item code is already registered for this client';end;
 return manufacturing_private.workspace();
end $$;
create function public.app_save_customer_item(
 p_item uuid,p_customer text,p_code text,p_name text,p_rate numeric,p_unit text,p_pieces_per_unit integer,p_revision bigint
) returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.save_customer_item(p_item,p_customer,p_code,p_name,p_rate,p_unit,p_pieces_per_unit,p_revision);
$$;
revoke all on function manufacturing_private.save_customer_item(uuid,text,text,text,numeric,text,integer,bigint),
 public.app_save_customer_item(uuid,text,text,text,numeric,text,integer,bigint) from public,anon;
grant execute on function manufacturing_private.save_customer_item(uuid,text,text,text,numeric,text,integer,bigint),
 public.app_save_customer_item(uuid,text,text,text,numeric,text,integer,bigint) to authenticated;

do $$
declare original text; definition text;
begin
 original:=pg_get_functiondef('manufacturing_private.workspace()'::regprocedure);
 definition:=replace(original,'''productionDefaults'',i.production_defaults)',
  '''productionDefaults'',i.production_defaults,''unit'',i.unit,''piecesPerUnit'',i.pieces_per_unit,''revision'',i.revision)');
 if definition=original then raise exception 'Unexpected catalog projection';end if;
 execute definition;
 original:=pg_get_functiondef('manufacturing_private.plan_create_order(text,uuid,integer,date,uuid)'::regprocedure);
 definition:=replace(original,'per_pack:=coalesce((item.production_defaults->>''perPack'')::integer,25);','per_pack:=item.pieces_per_unit;');
 if definition=original then raise exception 'Unexpected Plan Work unit defaults';end if;
 definition:=replace(definition,'''catalogRate'',item.rate,','''catalogRate'',item.rate,''catalogUnit'',item.unit,''catalogPiecesPerUnit'',item.pieces_per_unit,');
 execute definition;
 original:=pg_get_functiondef('manufacturing_private.save_order(jsonb,bigint,text)'::regprocedure);
 definition:=replace(original,'''catalogRate'',catalog_item.rate)',
  '''catalogRate'',catalog_item.rate,''catalogUnit'',catalog_item.unit,''catalogPiecesPerUnit'',catalog_item.pieces_per_unit)');
 if definition=original then raise exception 'Unexpected order catalog snapshot';end if;
 execute definition;
end $$;
commit;
