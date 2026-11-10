begin;
do $$
declare
 admin uuid;
 scanner uuid;
 view_name text;
 result jsonb;
 prefix text:='History fixture '||gen_random_uuid()::text;
 views text[]:=array['scans','customers','customer_items','orders','work_orders','sub_jobs','boxes',
   'production_records','dumping_assignments','dumping_completions','people','staff_profiles','bookings',
   'individual_availability','daily_attendance','individual_timesheets','quality_checks','packing_checks',
   'order_events','workforce_changes','barcode_approval_batches','order_schedules','calendar_exceptions','calendar_settings'];
begin
 select id into strict admin from public.staff_profiles where active and role='admin' limit 1;
 select id into strict scanner from public.staff_profiles where active and role='box_scanner' limit 1;
 perform set_config('request.jwt.claim.sub',admin::text,true);
 foreach view_name in array views loop
   result:=public.app_configuration_history(view_name,null,null,'',0);
   if jsonb_typeof(result->'columns') is distinct from 'array'
     or jsonb_typeof(result->'rows') is distinct from 'array'
     or (result->>'total')::integer<jsonb_array_length(result->'rows') then
     raise exception 'Unexpected history response for %',view_name;
   end if;
 end loop;

 insert into public.customers(id,name,created_at)
 select prefix||'-'||n,prefix||' '||n,timestamp '2026-11-10 12:00' at time zone 'America/Chicago'
 from generate_series(1,51) n;
 result:=public.app_configuration_history('customers','2026-11-10','2026-11-10',upper(prefix),0);
 if result->>'total' is distinct from '51' or jsonb_array_length(result->'rows')<>50 then
   raise exception 'Date, search or first page returned an incorrect result';
 end if;
 result:=public.app_configuration_history('customers','2026-11-10','2026-11-10',prefix,50);
 if result->>'total' is distinct from '51' or jsonb_array_length(result->'rows')<>1 then
   raise exception 'Second page returned an incorrect result';
 end if;
 if public.app_configuration_history('customers','2026-11-11',null,prefix,0)->>'total' is distinct from '0' then
   raise exception 'Date filter did not exclude older rows';
 end if;

 begin
   perform public.app_configuration_history('auth.users',null,null,'',0);
   raise exception 'Unsupported history source was accepted';
 exception when raise_exception then
   if sqlerrm not like 'Select a supported history view%' then raise; end if;
 end;

 perform set_config('request.jwt.claim.sub',scanner::text,true);
 begin
   perform public.app_configuration_history('scans',null,null,'',0);
   raise exception 'Scanner accessed administrative history';
 exception when insufficient_privilege then null;
 end;
end;
$$;
rollback;
