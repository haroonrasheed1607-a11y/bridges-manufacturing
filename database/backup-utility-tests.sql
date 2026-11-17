begin;
do $$declare admin uuid;other uuid;doc jsonb;setup jsonb;begin
 select id into strict admin from public.staff_profiles where active and role='admin' limit 1;
 perform set_config('request.jwt.claim.sub',admin::text,true);
 setup:=public.app_database_backup('setup');doc:=public.app_database_backup('data');
 if setup->>'environment'<>'staging' or setup->>'schemaFingerprint' is distinct from doc->>'schemaFingerprint' then raise exception 'Backup pair metadata does not match';end if;
 if position(chr(10)||'BEGIN;'||chr(10) in doc->>'sql')=0 or position(chr(10)||'BEGIN;'||chr(10) in setup->>'sql')=0 then raise exception 'Backup transaction header missing';end if;
 if (doc->>'bytes')::int<>octet_length(doc->>'sql') or (setup->>'bytes')::int<>octet_length(setup->>'sql') then raise exception 'Backup bytes differ';end if;
 if not (doc->'tableCounts') ? 'manufacturing_private.plan_day_unit_changes' or not (doc->'tableCounts') ? 'manufacturing_private.deactivated_plans' then raise exception 'Private audit data omitted';end if;
 if doc->'tableCounts' ? 'auth.users' or doc->'tableCounts' ? 'manufacturing_private.backup_settings' then raise exception 'Provider or environment configuration exported as data';end if;
 if position('pg_get_functiondef' in setup->>'sql')=0 or position('ROW LEVEL SECURITY' in setup->>'sql')=0 or position('CREATE POLICY' in setup->>'sql')=0 or position('pgrst.db_pre_request' in setup->>'sql')=0 then raise exception 'Setup recovery definitions omitted';end if;
 begin perform public.app_database_backup('unsupported');raise exception 'Invalid backup type accepted';exception when raise_exception then if sqlerrm not like 'Choose database setup%' then raise;end if;end;
 for other in select id from public.staff_profiles where active and role<>'admin' loop
  perform set_config('request.jwt.claim.sub',other::text,true);
  begin perform public.app_database_backup('data');raise exception 'Non-admin downloaded backup';exception when insufficient_privilege then null;end;
 end loop;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.app_database_backup('data');raise exception 'Anonymous backup accepted';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.app_database_backup(text)','EXECUTE') or has_function_privilege('authenticated','manufacturing_private.backup_setup_sql()','EXECUTE') or has_table_privilege('authenticated','manufacturing_private.backup_settings','SELECT') then raise exception 'Backup helper permissions exposed';end if;
end$$;
rollback;
