begin;
do $$
declare admin_id uuid; accounts_id uuid; scanner_id uuid; prefix text:='TEST-ACCOUNTS-RATES-'||gen_random_uuid();
 item uuid:=gen_random_uuid(); rows jsonb; old_order jsonb; new_order jsonb; payload jsonb; today date:=(clock_timestamp() at time zone 'America/Chicago')::date;
begin
 select id into strict admin_id from public.staff_profiles where active and role='admin' limit 1;
 select id into strict accounts_id from public.staff_profiles where active and role='accounts' limit 1;
 select id into strict scanner_id from public.staff_profiles where active and role='box_scanner' limit 1;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 insert into public.customers(id,name) values(prefix,prefix);
 perform public.app_save_customer_item(item,prefix,'RATE-1','Accounts rate fixture',null,'Box',25,0);
 begin perform public.app_save_customer_item(item,prefix,'RATE-1','Accounts rate fixture',.5,'Box',25,1);raise exception 'Admin edited rate';exception when insufficient_privilege then null;end;
 begin perform public.app_register_customer_item(prefix,'RATE-2','Forbidden rate',.5);raise exception 'Legacy registration set rate';exception when insufficient_privilege then null;end;
 begin perform public.app_accounts_save_item_rate(item,.5,1);raise exception 'Admin used Accounts rate API';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',accounts_id::text,true);
 rows:=public.app_accounts_save_item_rate(item,.5,1);
 if not exists(select 1 from public.customer_items where id=item and rate=.5 and revision=2)
  or not exists(select 1 from public.catalog_rate_changes where item_id=item and actor_id=accounts_id and previous_rate is null and new_rate=.5) then raise exception 'Accounts rate update/audit failed';end if;
 perform public.app_accounts_save_item_rate(item,.5,2);
 if (select count(*) from public.catalog_rate_changes where item_id=item)<>1 then raise exception 'Unchanged rate created audit';end if;
 begin perform public.app_accounts_save_item_rate(item,.75,1);raise exception 'Stale rate edit accepted';exception when serialization_failure then null;end;
 begin perform public.app_accounts_save_item_rate(item,-1,2);raise exception 'Negative rate accepted';exception when raise_exception then if sqlerrm<>'Enter a valid nonnegative rate' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 old_order:=public.app_plan_create_order(prefix,item,100,today,gen_random_uuid());
 -- Metadata edits can retain the rate, but cannot change it.
 perform public.app_save_customer_item(item,prefix,'RATE-1','Renamed item',.5,'Box',50,2);
 perform set_config('request.jwt.claim.sub',accounts_id::text,true);
 perform public.app_accounts_save_item_rate(item,.75,3);
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 new_order:=public.app_plan_create_order(prefix,item,100,today,gen_random_uuid());
 if (select (data->>'catalogRate')::numeric from public.orders where id=old_order->>'orderId')<>.5
  or (select (data->>'catalogRate')::numeric from public.orders where id=new_order->>'orderId')<>.75 then raise exception 'Rate snapshots changed incorrectly';end if;
 payload:=manufacturing_private.read_order(old_order->>'orderId');
 begin perform public.app_save_order(payload||'{"catalogRate":99}',(payload->>'_revision')::bigint,'Forbidden rate');raise exception 'Order snapshot rate edited';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',scanner_id::text,true);
 begin perform public.app_accounts_item_catalog();raise exception 'Scanner accessed Accounts catalog';exception when insufficient_privilege then null;end;
 begin perform public.app_accounts_save_item_rate(item,1,4);raise exception 'Scanner edited rate';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.app_accounts_save_item_rate(uuid,numeric,bigint)','execute') or has_table_privilege('authenticated','public.catalog_rate_changes','insert') then raise exception 'Rate API exposed';end if;
end $$;
rollback;
