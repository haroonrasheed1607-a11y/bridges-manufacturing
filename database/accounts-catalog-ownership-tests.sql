begin;
do $$
declare admin_id uuid; account_id uuid; scanner_id uuid; prefix text:='TEST-CATALOG-OWNERS-'||gen_random_uuid(); item uuid:=gen_random_uuid(); cid text; rows jsonb;
begin
 select id into strict admin_id from public.staff_profiles where active and role='admin' limit 1;
 select id into strict account_id from public.staff_profiles where active and role='accounts' limit 1;
 select id into strict scanner_id from public.staff_profiles where active and role='box_scanner' limit 1;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 begin perform public.app_save_customer(prefix);raise exception 'Admin created client';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',account_id::text,true);
 rows:=public.app_save_customer(prefix);
 select row->>'id' into strict cid from jsonb_array_elements(rows) row where row->>'name'=prefix;
 rows:=public.app_save_customer_item(item,cid,'CODE-1','Original item',.1,'Box',25,0);
 if not exists(select 1 from public.customer_items where id=item and rate=.1 and code='CODE-1' and name='Original item') then raise exception 'Accounts registration failed';end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.app_save_customer_item(item,cid,'CODE-1','Original item',.1,'Pack',50,1);
 if not exists(select 1 from public.customer_items where id=item and unit='Pack' and pieces_per_unit=50 and revision=2) then raise exception 'Manufacturing unit edit failed';end if;
 begin perform public.app_save_customer_item(item,cid,'FORBIDDEN','Original item',.1,'Pack',50,2);raise exception 'Admin changed code';exception when insufficient_privilege then null;end;
 begin perform public.app_save_customer_item(item,cid,'CODE-1','Forbidden name',.1,'Pack',50,2);raise exception 'Admin changed name';exception when insufficient_privilege then null;end;
 begin perform public.app_save_customer_item(item,cid,'CODE-1','Original item',.2,'Pack',50,2);raise exception 'Admin changed rate';exception when insufficient_privilege then null;end;
 begin perform public.app_save_customer_item(gen_random_uuid(),cid,'NEW','Forbidden creation',null,'Item',1,0);raise exception 'Admin created item';exception when insufficient_privilege then null;end;
 begin perform public.app_register_customer_item(cid,'LEGACY','Forbidden creation',null);raise exception 'Legacy item creation allowed';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',account_id::text,true);
 rows:=public.app_save_customer_item(item,cid,'CODE-NEW','Renamed item',.2,'Box',100,2);
 if not exists(select 1 from jsonb_array_elements(rows) c cross join lateral jsonb_array_elements(c->'items') i
  where i->>'id'=item::text and i @> '{"code":"CODE-NEW","name":"Renamed item","rate":0.2,"unit":"Box","piecesPerUnit":100,"revision":3}') then raise exception 'Accounts full edit failed';end if;
 if (select count(*) from public.catalog_rate_changes where item_id=item)<>2 then raise exception 'Rate audit missing';end if;
 perform set_config('request.jwt.claim.sub',scanner_id::text,true);
 begin perform public.app_save_customer_item(item,cid,'CODE-NEW','Renamed item',.2,'Box',50,3);raise exception 'Scanner edited units';exception when insufficient_privilege then null;end;
end $$;
rollback;
