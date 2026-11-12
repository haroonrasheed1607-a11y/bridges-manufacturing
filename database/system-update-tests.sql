begin;
select manufacturing_private.set_system_update(false);
select set_config('request.path','/rpc/app_get_workspace',true);
select public.app_request_guard();
select manufacturing_private.set_system_update(true);
do $$begin
 if not (public.app_system_status()->>'updating')::boolean then raise exception 'Maintenance bit not enabled';end if;
 begin perform public.app_request_guard();raise exception 'Business request allowed';exception when sqlstate 'PT503' then null;end;
 if has_function_privilege('authenticated','manufacturing_private.set_system_update(boolean)','execute')
  or has_function_privilege('anon','manufacturing_private.set_system_update(boolean)','execute')
  or has_table_privilege('authenticated','public.system_update_state','update') then raise exception 'Device can control maintenance';end if;
end $$;
select set_config('request.path','/rpc/app_system_status',true);
select public.app_request_guard();
set local role anon;
select public.app_system_status();
reset role;
select manufacturing_private.set_system_update(false);
select set_config('request.path','/rpc/app_get_workspace',true);
select public.app_request_guard();
rollback;
