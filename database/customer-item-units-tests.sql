begin;
do $$
declare
 actor uuid; scanner uuid; prefix text:='TEST-ITEM-UNITS-'||gen_random_uuid(); cid text:=prefix||'-CLIENT';
 item uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); old_order jsonb; new_order jsonb; data jsonb;
 today date:=(clock_timestamp() at time zone 'America/Chicago')::date;
begin
 select id into strict actor from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.customers(id,name) values(cid,prefix);
 data:=public.app_save_customer_item(item,cid,'PART-1','Box of parts',0.12,'Box',50,0);
 if not exists(select 1 from jsonb_array_elements(data->'customerCatalog') c cross join lateral jsonb_array_elements(c->'items') i
  where i->>'id'=item::text and i @> '{"unit":"Box","piecesPerUnit":50,"revision":1,"productionDefaults":{"perPack":50}}') then raise exception 'Catalog unit projection failed';end if;
 old_order:=public.app_plan_create_order(cid,item,250,today,gen_random_uuid());
 data:=public.app_save_customer_item(item,cid,'PART-NEW','Updated box of parts',0.15,'Pack',100,1);
 if not exists(select 1 from public.customer_items where id=item and unit='Pack' and pieces_per_unit=100 and revision=2 and production_defaults @> '{"perPack":100}') then raise exception 'Edit did not save';end if;
 new_order:=public.app_plan_create_order(cid,item,250,today,gen_random_uuid());
 if not exists(select 1 from public.work_orders where id=old_order->>'workId' and pieces_per_pack=50 and scan_pieces=50)
  or not exists(select 1 from public.orders o where id=old_order->>'orderId' and o.data @> '{"title":"Box of parts","catalogCode":"PART-1","catalogUnit":"Box","catalogPiecesPerUnit":50,"catalogRate":0.12}') then raise exception 'Editing changed existing order';end if;
 if not exists(select 1 from public.work_orders where id=new_order->>'workId' and pieces_per_pack=100 and scan_pieces=100)
  or not exists(select 1 from public.orders o where id=new_order->>'orderId' and o.data @> '{"title":"Updated box of parts","catalogCode":"PART-NEW","catalogUnit":"Pack","catalogPiecesPerUnit":100,"catalogRate":0.15}') then raise exception 'New order did not use edited values';end if;
 begin perform public.app_save_customer_item(item,cid,'STALE','Wrong',1,'Item',1,1);raise exception 'Stale edit accepted';exception when serialization_failure then null;end;
 begin perform public.app_save_customer_item(other,cid,' part-new ','Duplicate',1,'Item',1,0);raise exception 'Duplicate code accepted';exception when raise_exception then if sqlerrm<>'That item code is already registered for this client' then raise;end if;end;
 begin perform public.app_save_customer_item(other,cid,'OTHER','Invalid',1,'Box',0,0);raise exception 'Empty box accepted';exception when raise_exception then if sqlerrm not like 'Enter 1–1,000,000 pieces%' then raise;end if;end;
 begin perform public.app_save_customer_item(other,cid,'OTHER','Invalid',1,'Bag',10,0);raise exception 'Invalid unit accepted';exception when raise_exception then if sqlerrm<>'Select Item, Pack or Box' then raise;end if;end;
 begin perform public.app_save_customer_item(other,cid,'OTHER','Invalid',-1,'Item',1,0);raise exception 'Negative rate accepted';exception when raise_exception then if sqlerrm<>'Enter a valid nonnegative rate' then raise;end if;end;
 perform public.app_save_customer_item(other,cid,'SINGLE','One item',null,'Item',100,0);
 if not exists(select 1 from public.customer_items where id=other and unit='Item' and pieces_per_unit=1 and production_defaults @> '{"perPack":1}') then raise exception 'Item unit was not normalized';end if;
 perform set_config('request.jwt.claim.sub',scanner::text,true);
 begin perform public.app_save_customer_item(item,cid,'FORBIDDEN','Forbidden',1,'Box',100,2);raise exception 'Scanner edited catalog';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.app_save_customer_item(uuid,text,text,text,numeric,text,integer,bigint)','execute')
  or has_table_privilege('authenticated','public.customer_items','update') then raise exception 'Catalog edit exposed';end if;
end $$;
rollback;
