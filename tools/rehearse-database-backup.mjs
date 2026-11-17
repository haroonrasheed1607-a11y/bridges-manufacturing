// Run only against local download files; PostgreSQL is in memory, never a hosted database.
// Pass a locally installed @electric-sql/pglite module URL as argument 5.
const { PGlite } = await import(process.argv[5] || '@electric-sql/pglite');
import { readFile } from 'node:fs/promises';
const db=new PGlite();
await db.waitReady;
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE authenticator;CREATE ROLE supabase_auth_admin;CREATE ROLE supabase_admin;CREATE ROLE dashboard_user;CREATE ROLE supabase_storage_admin;
CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE SCHEMA extensions;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb,raw_app_meta_data jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('request.jwt.claim.role',true)$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT '{}'::jsonb$$;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid,bucket_id text,name text,owner uuid,metadata jsonb);
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$SELECT string_to_array($1,'/')$$;`);
if (!process.argv[2] || !process.argv[3] || !process.argv[4]) throw Error('Usage: node tools/rehearse-database-backup.mjs setup.sql data.sql counts.json [pglite-module-url]');
const setup=await readFile(process.argv[2],'utf8');
const data=await readFile(process.argv[3],'utf8');
try{
 await db.exec(setup);console.log('SETUP_RESTORED');
 const ids=[...new Set(data.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi))];
 for(const id of ids)await db.query('INSERT INTO auth.users(id) VALUES($1) ON CONFLICT DO NOTHING',[id]);
 console.log('AUTH_PREREQUISITE_IDS',ids.length);
 await db.exec(data);console.log('DATA_RESTORED');
 const counts=JSON.parse(await readFile(process.argv[4],'utf8'));
 for(const [table,count] of Object.entries(counts)){
  const actual=(await db.query('select count(*)::int n from '+table)).rows[0].n;
  if(actual!==count)throw Error('Row count mismatch '+table);
 }
 console.log('ALL_TABLE_COUNTS_MATCH',Object.keys(counts).length);
 await db.exec('BEGIN; ALTER TABLE public.orders ADD COLUMN backup_mismatch_fixture integer;');
 try{await db.exec(data);throw Error('Schema mismatch accepted');}catch(e){if(!e.message.includes('Schema fingerprint mismatch'))throw e;console.log('SCHEMA_MISMATCH_REJECTED');}finally{await db.exec('ROLLBACK');}
 await db.exec('BEGIN');
 try{await db.exec(data);throw Error('Existing-data guard failed');}catch(e){if(!e.message.includes('Data restore requires an empty destination'))throw e;console.log('SECOND_RESTORE_REJECTED',e.message);}finally{await db.exec('ROLLBACK');}

}catch(e){console.log('RESTORE_ERROR',e.message);if(e.query)console.log(e.query.slice(0,200));process.exitCode=1;}
await db.close();
