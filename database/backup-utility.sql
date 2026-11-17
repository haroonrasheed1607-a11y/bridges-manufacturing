-- Staging rollout. Production requires separate release approval.
do $$begin
 if not exists(select 1 from public.customers where id='STAGE-CLIENT') and current_setting('bridges.release_approval',true) is distinct from 'backup-approved' then raise exception 'Backup utility requires explicit production approval';end if;
end$$;
create table manufacturing_private.backup_settings(id boolean primary key default true check(id),environment text not null check(environment in ('staging','production')));
alter table manufacturing_private.backup_settings enable row level security;
revoke all on manufacturing_private.backup_settings from public,anon,authenticated,service_role;
insert into manufacturing_private.backup_settings(environment) select case when exists(select 1 from public.customers where id='STAGE-CLIENT') then 'staging' else 'production' end;

-- Serialize the live application catalog, excluding provider/extension-owned objects.
-- No credentials, Auth sessions, Vault values, Storage files or migration SQL are read.
create function manufacturing_private.backup_setup_sql() returns text
language plpgsql stable security definer set search_path='' as $$
declare
 schemas text[]:=array['public','manufacturing_private','manufacturing_maintenance','manufacturing_reset_backup'];
 out_sql text:='SET standard_conforming_strings = on;'||chr(10)||'SET check_function_bodies = false;'||chr(10);
 r record;acl_entry record;cols text;def text;done oid[]:='{}';todo integer;progress boolean;
begin
 if exists(select 1 from pg_attribute col join pg_class tbl on tbl.oid=col.attrelid join pg_namespace ns on ns.oid=tbl.relnamespace where ns.nspname=any(schemas) and col.attacl is not null) or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=any(schemas) and c.relkind in ('S','m','p','f'))
 or exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname=any(schemas) and t.typtype in ('e','d'))
 or exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=any(schemas) and c.relkind='r' and (a.attidentity<>'' or a.attgenerated<>'')) then
 raise exception 'New database object types require an updated backup serializer; no partial backup was created';end if;
 for r in select n.* from pg_namespace n where n.nspname=any(schemas) order by n.nspname collate "C" loop
  out_sql:=out_sql||format('CREATE SCHEMA IF NOT EXISTS %I;',r.nspname)||chr(10);
 end loop;
 -- Tables first, constraints later: cross-table row types are now available to functions.
 for r in select c.*,n.nspname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=any(schemas) and c.relkind='r' order by n.nspname collate "C",c.relname collate "C" loop
  select string_agg(format('%I %s%s%s',a.attname,format_type(a.atttypid,a.atttypmod),case when d.oid is not null then ' DEFAULT '||pg_get_expr(d.adbin,d.adrelid) else '' end,case when a.attnotnull then ' NOT NULL' else '' end),','||chr(10) order by a.attnum) into cols
   from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped;
  out_sql:=out_sql||format('CREATE TABLE %I.%I (%s);',r.nspname,r.relname,cols)||chr(10);
 end loop;
 for r in select con.*,n.nspname,c.relname from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=any(schemas) and con.contype in ('p','u','c','f','x') order by case when con.contype='f' then 1 else 0 end,n.nspname collate "C",c.relname collate "C",con.conname collate "C" loop
  out_sql:=out_sql||format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s;',r.nspname,r.relname,r.conname,pg_get_constraintdef(r.oid,true))||chr(10);
 end loop;
 for r in select i.indexrelid from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=any(schemas) and not exists(select 1 from pg_constraint con where con.conindid=i.indexrelid) order by n.nspname collate "C",c.relname collate "C",i.indexrelid::regclass::text collate "C" loop
  out_sql:=out_sql||pg_get_indexdef(r.indexrelid)||';'||chr(10);
 end loop;
 -- Function body checking is deferred until all functions and views exist.
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=any(schemas) and p.prokind='f' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') order by n.nspname collate "C",p.oid::regprocedure::text collate "C" loop
  out_sql:=out_sql||pg_get_functiondef(r.oid)||';'||chr(10);
 end loop;
 -- Topological order handles nested views without relying on object creation OIDs.
 loop
  select count(*) into todo from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=any(schemas) and c.relkind='v' and not(c.oid=any(done));
  exit when todo=0;progress:=false;
  for r in select c.*,n.nspname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=any(schemas) and c.relkind='v' and not(c.oid=any(done)) order by n.nspname collate "C",c.relname collate "C" loop
   if exists(select 1 from pg_rewrite rw join pg_depend d on d.classid='pg_rewrite'::regclass and d.objid=rw.oid join pg_class parent on parent.oid=d.refobjid join pg_namespace pn on pn.oid=parent.relnamespace where rw.ev_class=r.oid and parent.relkind='v' and pn.nspname=any(schemas) and parent.oid<>r.oid and not(parent.oid=any(done))) then continue;end if;
   out_sql:=out_sql||format('CREATE VIEW %I.%I%s AS %s;',r.nspname,r.relname,case when cardinality(r.reloptions)>0 then ' WITH ('||array_to_string(r.reloptions,',')||')' else '' end,rtrim(pg_get_viewdef(r.oid,true),';'||chr(10)))||chr(10);
   done:=array_append(done,r.oid);progress:=true;
  end loop;
  if not progress then raise exception 'Unsupported cyclic view dependency';end if;
 end loop;
 for r in select t.*,n.nspname,c.relname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=any(schemas) and not t.tgisinternal order by n.nspname collate "C",c.relname collate "C",t.tgname collate "C" loop
  out_sql:=out_sql||pg_get_triggerdef(r.oid,true)||';'||chr(10);
  if r.tgenabled<>'O' then out_sql:=out_sql||format('ALTER TABLE %I.%I %s TRIGGER %I;',r.nspname,r.relname,case r.tgenabled when 'D' then 'DISABLE' when 'A' then 'ENABLE ALWAYS' else 'ENABLE REPLICA' end,r.tgname)||chr(10);end if;
 end loop;
 -- Application storage policies are setup, not uploaded object data.
 for r in select p.*,n.nspname,c.relname from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=any(schemas) or (n.nspname='storage' and p.polname like 'manufacturing_%') order by n.nspname collate "C",c.relname collate "C",p.polname collate "C" loop
  select string_agg(case when role_id=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(role_id)) end,',' order by (case when role_id=0 then 'PUBLIC' else pg_get_userbyid(role_id) end) collate "C") into cols from unnest(r.polroles) role_id;
  out_sql:=out_sql||format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',r.polname,r.nspname,r.relname,case when r.polpermissive then 'PERMISSIVE' else 'RESTRICTIVE' end,case r.polcmd when '*' then 'ALL' when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' else 'DELETE' end,cols,case when r.polqual is not null then ' USING ('||pg_get_expr(r.polqual,r.polrelid)||')' else '' end,case when r.polwithcheck is not null then ' WITH CHECK ('||pg_get_expr(r.polwithcheck,r.polrelid)||')' else '' end)||chr(10);
 end loop;
 for r in select c.*,n.nspname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=any(schemas) and c.relkind in ('r','v') order by n.nspname collate "C",c.relname collate "C" loop
  if r.relrowsecurity then out_sql:=out_sql||format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;',r.nspname,r.relname)||chr(10);end if;
  if r.relforcerowsecurity then out_sql:=out_sql||format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY;',r.nspname,r.relname)||chr(10);end if;
  out_sql:=out_sql||format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC,anon,authenticated,service_role;',r.nspname,r.relname)||chr(10);
  for acl_entry in select * from aclexplode(coalesce(r.relacl,acldefault('r',r.relowner))) where grantee<>r.relowner order by (case when grantee=0 then 'PUBLIC' else pg_get_userbyid(grantee) end) collate "C",privilege_type collate "C" loop
   out_sql:=out_sql||format('GRANT %s ON TABLE %I.%I TO %s%s;',acl_entry.privilege_type,r.nspname,r.relname,case when acl_entry.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(acl_entry.grantee)) end,case when acl_entry.is_grantable then ' WITH GRANT OPTION' else '' end)||chr(10);
  end loop;
 end loop;
 for r in select p.*,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=any(schemas) and p.prokind='f' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') order by n.nspname collate "C",p.oid::regprocedure::text collate "C" loop
  out_sql:=out_sql||format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC,anon,authenticated,service_role;',r.nspname,r.proname,pg_get_function_identity_arguments(r.oid))||chr(10);
  for acl_entry in select * from aclexplode(coalesce(r.proacl,acldefault('f',r.proowner))) where grantee<>r.proowner order by (case when grantee=0 then 'PUBLIC' else pg_get_userbyid(grantee) end) collate "C",privilege_type collate "C" loop
   out_sql:=out_sql||format('GRANT %s ON FUNCTION %I.%I(%s) TO %s%s;',acl_entry.privilege_type,r.nspname,r.proname,pg_get_function_identity_arguments(r.oid),case when acl_entry.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(acl_entry.grantee)) end,case when acl_entry.is_grantable then ' WITH GRANT OPTION' else '' end)||chr(10);
  end loop;
 end loop;
 for r in select * from pg_namespace where nspname=any(schemas) order by nspname collate "C" loop
  out_sql:=out_sql||format('REVOKE ALL ON SCHEMA %I FROM PUBLIC,anon,authenticated,service_role;',r.nspname)||chr(10);
  for acl_entry in select * from aclexplode(coalesce(r.nspacl,acldefault('n',r.nspowner))) where grantee<>r.nspowner order by (case when grantee=0 then 'PUBLIC' else pg_get_userbyid(grantee) end) collate "C",privilege_type collate "C" loop
   out_sql:=out_sql||format('GRANT %s ON SCHEMA %I TO %s%s;',acl_entry.privilege_type,r.nspname,case when acl_entry.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(acl_entry.grantee)) end,case when acl_entry.is_grantable then ' WITH GRANT OPTION' else '' end)||chr(10);
  end loop;
 end loop;
 -- Preserve defaults for objects created by the application database owner.
 -- Managed Supabase-role defaults remain the provider's responsibility.
 for r in select d.*,n.nspname from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where d.defaclrole=(select oid from pg_roles where rolname=current_user) and (n.nspname=any(schemas) or d.defaclnamespace=0) order by coalesce(n.nspname,'') collate "C",d.defaclobjtype loop
  cols:=case r.defaclobjtype when 'r' then 'TABLES' when 'f' then 'FUNCTIONS' when 'S' then 'SEQUENCES' when 'T' then 'TYPES' when 'n' then 'SCHEMAS' end;
  if cols is null then raise exception 'Unsupported default privilege type';end if;
  def:=format('ALTER DEFAULT PRIVILEGES FOR ROLE %I%s ',pg_get_userbyid(r.defaclrole),case when r.nspname is null then '' else format(' IN SCHEMA %I',r.nspname) end);
  out_sql:=out_sql||def||format('REVOKE ALL ON %s FROM PUBLIC,anon,authenticated,service_role;',cols)||chr(10);
  for acl_entry in select * from aclexplode(r.defaclacl) where grantee<>r.defaclrole order by (case when grantee=0 then 'PUBLIC' else pg_get_userbyid(grantee) end) collate "C",privilege_type collate "C" loop
   out_sql:=out_sql||def||format('GRANT %s ON %s TO %s%s;',acl_entry.privilege_type,cols,case when acl_entry.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(acl_entry.grantee)) end,case when acl_entry.is_grantable then ' WITH GRANT OPTION' else '' end)||chr(10);
  end loop;
 end loop;
 -- PostgREST's maintenance guard must survive rebuilding the database.
 for r in select roles.rolname,cfg from pg_db_role_setting s join pg_roles roles on roles.oid=s.setrole cross join lateral unnest(s.setconfig) cfg where s.setdatabase=0 and cfg like 'pgrst.db_pre_request=%' order by roles.rolname collate "C" loop
  out_sql:=out_sql||format('ALTER ROLE %I SET pgrst.db_pre_request = %L;',r.rolname,substring(r.cfg from position('=' in r.cfg)+1))||chr(10);
 end loop;
 -- Recreate the application's private bucket configuration; object bytes remain separate.
 for r in select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id='manufacturing-files' loop
  out_sql:=out_sql||format('INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES(%L,%L,%L,%L,%L) ON CONFLICT(id) DO NOTHING;',r.id,r.name,r.public,r.file_size_limit,r.allowed_mime_types)||chr(10);
 end loop;
 return out_sql;
end$$;
revoke all on function manufacturing_private.backup_setup_sql() from public,anon,authenticated,service_role;

create function manufacturing_private.database_backup(p_kind text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 schemas text[]:=array['public','manufacturing_private','manufacturing_maintenance','manufacturing_reset_backup'];
 setup_sql text;body text:='';tail text:='';file_sql text;env text;stamp timestamptz:=statement_timestamp();
 r record;t record;rows jsonb;cols text;row_count bigint;counts jsonb:='{}';done oid[]:='{}';progress boolean;todo integer;fingerprint text;
begin
 if auth.uid() is null or manufacturing_private.actor_role() is distinct from 'admin' then raise exception 'Administrator access required' using errcode='42501';end if;
 if p_kind is null or p_kind not in ('setup','data') then raise exception 'Choose database setup or data backup';end if;
 select environment into env from manufacturing_private.backup_settings where id;
 if env is null then raise exception 'An operator must configure this backup environment before downloading';end if;
 setup_sql:=manufacturing_private.backup_setup_sql();fingerprint:=md5(setup_sql);
 if p_kind='setup' then
  body:=$guard$DO $empty$BEGIN IF to_regclass('public.orders') IS NOT NULL THEN RAISE EXCEPTION 'Setup requires a fresh Supabase project without application tables';END IF;END$empty$;
$guard$||setup_sql;
 else
  body:=format($guard$DO $schema$BEGIN IF md5(manufacturing_private.backup_setup_sql())<>%L THEN RAISE EXCEPTION 'Schema fingerprint mismatch. Restore the matching setup backup first';END IF;END$schema$;
$guard$,fingerprint);
  -- Disable only application user triggers; foreign keys stay enabled throughout.
  -- First assert all destination tables are empty, before inserting any records.
  for r in select c.oid,n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=any(schemas) and c.relkind='r' and not(n.nspname='manufacturing_private' and c.relname='backup_settings') order by n.nspname collate "C",c.relname collate "C" loop
   body:=body||format('DO $empty$BEGIN IF EXISTS(SELECT 1 FROM %I.%I LIMIT 1) THEN RAISE EXCEPTION %L;END IF;END$empty$;',r.nspname,r.relname,'Data restore requires an empty destination: '||r.nspname||'.'||r.relname)||chr(10);
   for t in select * from pg_trigger where tgrelid=r.oid and not tgisinternal and tgenabled<>'D' order by tgname loop
    body:=body||format('ALTER TABLE %I.%I DISABLE TRIGGER %I;',r.nspname,r.relname,t.tgname)||chr(10);
    tail:=tail||format('ALTER TABLE %I.%I %s TRIGGER %I;',r.nspname,r.relname,case t.tgenabled when 'A' then 'ENABLE ALWAYS' when 'R' then 'ENABLE REPLICA' else 'ENABLE' end,t.tgname)||chr(10);
   end loop;
  end loop;
  loop
   select count(*) into todo from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=any(schemas) and c.relkind='r' and not(c.oid=any(done)) and not(n.nspname='manufacturing_private' and c.relname='backup_settings');
   exit when todo=0;progress:=false;
   for r in select c.oid,n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=any(schemas) and c.relkind='r' and not(c.oid=any(done)) and not(n.nspname='manufacturing_private' and c.relname='backup_settings') order by n.nspname collate "C",c.relname collate "C" loop
    if exists(select 1 from pg_constraint fk join pg_class parent on parent.oid=fk.confrelid join pg_namespace pn on pn.oid=parent.relnamespace where fk.conrelid=r.oid and fk.contype='f' and pn.nspname=any(schemas) and fk.confrelid<>r.oid and not(fk.confrelid=any(done))) then continue;end if;
    execute format('SELECT coalesce(jsonb_agg(to_jsonb(backup_row) ORDER BY to_jsonb(backup_row)::text),''[]''::jsonb),count(*) FROM %I.%I backup_row',r.nspname,r.relname) into rows,row_count;
    counts:=counts||jsonb_build_object(r.nspname||'.'||r.relname,row_count);
    if row_count>0 then
     select string_agg(quote_ident(attname),',' order by attnum) into cols from pg_attribute where attrelid=r.oid and attnum>0 and not attisdropped;
     body:=body||format('INSERT INTO %I.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::%I.%I,%L::jsonb);',r.nspname,r.relname,cols,cols,r.nspname,r.relname,rows::text)||chr(10);
    end if;
    done:=array_append(done,r.oid);progress:=true;
    if octet_length(body)>16777216 then raise exception 'Backup exceeds the 16 MiB download limit; use an operator-managed database dump';end if;
   end loop;
   if not progress then raise exception 'Unsupported cyclic table dependency; use an operator-managed database dump';end if;
  end loop;
  body:=body||tail;
 end if;
 file_sql:=format(E'-- Bridges Manufacturing %s backup\n-- Environment: %s\n-- Created: %s\n-- Format: 1; schema fingerprint: %s\n-- Run as database owner on a fresh Supabase project. Auth users/UUIDs must be recovered separately before data restore.\n-- Uploaded files, Auth credentials/sessions, Vault secrets and Edge Function deployments are not included.\nBEGIN;\nSET standard_conforming_strings = on;\n',p_kind,env,stamp,fingerprint)||body||chr(10)||'COMMIT;'||chr(10);
 if octet_length(file_sql)>16777216 then raise exception 'Backup exceeds the 16 MiB download limit';end if;
 return jsonb_build_object('formatVersion',1,'kind',p_kind,'environment',env,'createdAt',stamp,'schemaFingerprint',fingerprint,'postgresVersion',current_setting('server_version'),'databaseBytes',pg_database_size(current_database()),'bytes',octet_length(file_sql),'tableCounts',counts,'sql',file_sql);
end$$;
create function public.app_database_backup(p_kind text) returns jsonb language sql stable security invoker set search_path='' as $$select manufacturing_private.database_backup(p_kind);$$;
revoke all on function manufacturing_private.database_backup(text),public.app_database_backup(text) from public,anon,service_role;
grant execute on function manufacturing_private.database_backup(text),public.app_database_backup(text) to authenticated;
