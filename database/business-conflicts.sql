-- Apply after the feature SQL files. Preserve definitions, owners and grants.
-- Application conflicts must not use PostgreSQL serialization_failure (40001):
-- PostgREST 14 retries it indefinitely. PT409 returns one HTTP 409 response.
do $migration$
declare f record; definition text;
begin
 for f in
   select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='manufacturing_private' and p.prokind='f'
     and p.prosrc ~* 'errcode\s*=\s*''40001'''
 loop
   definition:=pg_get_functiondef(f.oid);
   definition:=regexp_replace(definition,'(errcode\s*=\s*)''40001''','\1''PT409''','gi');
   execute definition;
 end loop;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='manufacturing_private' and p.prosrc ~* 'errcode\s*=\s*''40001''')
 then raise exception 'Retryable business conflicts remain';end if;
end
$migration$;
