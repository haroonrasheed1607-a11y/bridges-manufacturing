begin;
do $$
declare admin_id uuid; scanner_id uuid; client_id text; item_id uuid; workspace jsonb; created jsonb;
 order_payload jsonb:='{"id":"TEST-CATALOG-ORDER","title":"Wrong title","customer":"Catalog test client","quantity":10,"perPack":5,"stage":0,"workOrders":[],"required":"2026-12-01"}';
begin
 select id into strict admin_id from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner_id from public.staff_profiles where active and role='box_scanner' limit 1;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.app_save_customer('Catalog test client');
 select id into strict client_id from public.customers where name='Catalog test client';
 begin
   perform public.app_save_order(order_payload,0,'Catalog test');
   raise exception 'Order without catalog item accepted';
 exception when raise_exception then if sqlerrm<>'Select a registered item for this client' then raise;end if;end;
 perform public.app_register_customer_item(client_id,'ABC-1','Assembly kit',0.0125);
 select id into strict item_id from public.customer_items where code='ABC-1' and customer_items.customer_id=client_id;
 perform public.app_save_order(order_payload||jsonb_build_object('catalogItemId',item_id),0,'Catalog test');
 select data into strict created from public.orders where id='TEST-CATALOG-ORDER';
 if created->>'title'<>'Assembly kit' or created->>'catalogCode'<>'ABC-1' or (created->>'catalogRate')::numeric<>0.0125 then
   raise exception 'Order did not snapshot catalog item';
 end if;
 workspace:=public.app_get_workspace();
 if not exists(select 1 from jsonb_array_elements(workspace->'customerCatalog') x where x->>'id'=client_id and jsonb_array_length(x->'items')=1) then
   raise exception 'Registered item missing from workspace';
 end if;
 perform set_config('request.jwt.claim.sub',scanner_id::text,true);
 if jsonb_array_length(public.app_get_workspace()->'customerCatalog')<>0 then raise exception 'Catalog exposed to scanner';end if;
 begin
   perform public.app_register_customer_item(client_id,'ABC-2','Forbidden',null);
   raise exception 'Scanner registered item';
 exception when insufficient_privilege then null;end;
end$$;
rollback;
