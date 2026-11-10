begin;

create table if not exists public.customer_items (
 id uuid primary key default gen_random_uuid(),
 customer_id text not null references public.customers(id) on delete cascade,
 code text not null check(length(trim(code)) between 1 and 80),
 name text not null check(length(trim(name)) between 1 and 180),
 rate numeric check(rate>=0 and rate<1000000000)
);
create unique index if not exists customer_items_code_unique on public.customer_items(customer_id,lower(trim(code)));
alter table public.customer_items enable row level security;
revoke all on public.customer_items from public,anon,authenticated;

create or replace function manufacturing_private.register_customer_item(p_customer text,p_code text,p_name text,p_rate numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform manufacturing_private.require_manager();
 if not exists(select 1 from public.customers where id=p_customer) then raise exception 'Select a registered client';end if;
 if coalesce(length(trim(p_code)),0) not between 1 and 80 or coalesce(length(trim(p_name)),0) not between 1 and 180 then
   raise exception 'Enter an item code and item name';
 end if;
 insert into public.customer_items(customer_id,code,name,rate) values(p_customer,trim(p_code),trim(p_name),p_rate)
 on conflict(customer_id,lower(trim(code))) do nothing;
 if not found then raise exception 'That item code is already registered for this client';end if;
 return manufacturing_private.workspace();
end$$;
create or replace function public.app_register_customer_item(p_customer text,p_code text,p_name text,p_rate numeric default null)
returns jsonb language sql security invoker set search_path='' as $$
 select manufacturing_private.register_customer_item(p_customer,p_code,p_name,p_rate);
$$;
revoke all on function manufacturing_private.register_customer_item(text,text,text,numeric),public.app_register_customer_item(text,text,text,numeric) from public,anon;
grant execute on function manufacturing_private.register_customer_item(text,text,text,numeric),public.app_register_customer_item(text,text,text,numeric) to authenticated;

do $patch$
declare definition text;
 old_customer_check text:=$old$if cid is null then cid:='CUS-'||gen_random_uuid()::text;insert into public.customers(id,name) values(cid,trim(p_order->>'customer'));end if;$old$;
 new_customer_check text:=$new$
 if cid is null then raise exception 'Select a registered client';end if;
 if old.id is null then
   select * into catalog_item from public.customer_items
   where id::text=p_order->>'catalogItemId' and customer_id=cid;
   if not found then raise exception 'Select a registered item for this client';end if;
   p_order:=p_order||jsonb_build_object('title',catalog_item.name,'catalogItemId',catalog_item.id,'catalogCode',catalog_item.code,'catalogRate',catalog_item.rate);
 end if;
$new$;
begin
 definition:=pg_get_functiondef('manufacturing_private.workspace()'::regprocedure);
 if position('''customerCatalog''' in definition)=0 then
   if position('''workforce'',jsonb_build_object' in definition)=0 then raise exception 'Unexpected workspace function';end if;
   definition:=replace(definition,'''workforce'',jsonb_build_object',$catalog$
     'customerCatalog',case when r in ('admin','manager') then coalesce((
       select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'items',coalesce((
         select jsonb_agg(jsonb_build_object('id',i.id,'code',i.code,'name',i.name,'rate',i.rate) order by i.name,i.code)
         from public.customer_items i where i.customer_id=c.id
       ),'[]')) order by c.name) from public.customers c
     ),'[]') else '[]'::jsonb end,
     'workforce',jsonb_build_object$catalog$);
   execute definition;
 end if;
 definition:=pg_get_functiondef('manufacturing_private.save_order(jsonb,bigint,text)'::regprocedure);
 if position('catalog_item public.customer_items' in definition)=0 then
   if position(old_customer_check in definition)=0 or position('declare old public.orders;' in definition)=0 then
     raise exception 'Unexpected order save function';
   end if;
   definition:=replace(definition,'declare old public.orders;','declare old public.orders;catalog_item public.customer_items;');
   definition:=replace(definition,old_customer_check,new_customer_check);
   execute definition;
 end if;
 definition:=pg_get_functiondef('manufacturing_private.read_order(text)'::regprocedure);
 if position('''catalogRate''' in definition)=0 then
   if position('result:=' in definition)=0 or position('''customer_snapshot''' in definition)=0 then
     raise exception 'Unexpected order visibility function';
   end if;
   definition:=replace(definition,'-''customer_snapshot''','-''customer_snapshot''-''catalogRate''');
   execute definition;
 end if;
end
$patch$;

commit;
