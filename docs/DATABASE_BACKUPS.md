# Database backup utility

Staging-only rollout. Production requires a separate approval and migration.

Configurations → Backup offers admin-only setup SQL and data SQL downloads. Each file identifies its environment, timestamp, format version and schema fingerprint. The data download includes table row counts in the UI. Downloads are generated from the current database, never bundled into the frontend or stored publicly.

## Coverage

Application schemas: public, manufacturing_private, manufacturing_maintenance and manufacturing_reset_backup when present. Provider schemas, extensions and provider-owned function definitions are excluded. Setup serializes application tables, constraints, indexes, functions, triggers, views, RLS, policies and grants, application-owner default grants, manufacturing storage policies and bucket configuration, and the PostgREST request guard. Managed Supabase defaults and roles must already exist in the target Supabase project. New unsupported object types or column-specific grants fail closed rather than silently produce an incomplete setup export.

Data includes all application rows, including inactive records and private audit history. Operational backup_settings is excluded so the destination environment cannot be mislabeled by source settings. Auth users/passwords/sessions, uploaded object bytes and metadata, Vault secrets, Edge Function code/secrets and hosting configuration require separate recovery. Staff profiles and historical actor references require their corresponding original Auth user UUIDs.

The endpoint is STABLE: all its read statements use one statement snapshot. Admin authorization is enforced in the database, not just in the UI. Raw serializer functions and environment configuration have no API-role grants. No service-role key or database password is sent to the browser. The exporter returns a single JSON object, avoiding table-pagination truncation. Files have a 16 MiB cap; larger databases need an operator-managed dump/streaming backup.

## Recovery

Only restore to a fresh Supabase project using the database owner and stop-on-error SQL execution. This utility provides no browser restore endpoint and never deletes existing records.

1. Recover/create the Auth accounts with their original UUIDs using the provider recovery procedure. Set up separate Edge Function secrets and files; no credentials are in these downloads.
2. Run setup.sql. It refuses a destination containing public.orders. It creates no business rows.
3. Run the matching data.sql. It checks the exact live schema fingerprint and requires all destination application tables to be empty. Tables load in foreign-key order with foreign keys enabled. User triggers are temporarily disabled and restored within the transaction, preserving snapshot quantities/rates and inactive records without replaying production triggers. A failed restore rolls back.
4. Verify the row counts from the backup, security, reports, QR behavior and Auth mapping. Existing provider roles/extensions/storage tables must be available. A standalone vanilla PostgreSQL instance needs equivalent provider prerequisites; this is an application backup, not a whole Supabase platform image.
5. Configure the destination backup label explicitly as operator:

```sql
insert into manufacturing_private.backup_settings(environment)
values ('staging') -- choose production only for the production project
on conflict(id) do update set environment=excluded.environment;
```

6. Deploy the application and Edge Functions, recover uploads, configure provider URLs/secrets, verify maintenance, then reopen access. Download a new matching setup/data pair after each schema change.

## Verification

86 app tests and staging build pass. Database tests cover admin-only access, anonymous/non-admin denial, type validation, matching fingerprints, byte sizes, private-audit inclusion and helper permissions. An isolated PostgreSQL/WASM rehearsal with provider prerequisite stubs rebuilds the application schema from the downloaded setup, imports the downloaded data, compares every table count and verifies rejection of a second restore and a mismatched schema. This validates application recovery; provider Auth and file recovery remain separate.

Backups contain confidential production/pay information. Store downloads in an approved secure location; no automatic retention, encryption service or scheduling is configured by this feature. The UI reports download preparation, not proof that the browser saved the file.
