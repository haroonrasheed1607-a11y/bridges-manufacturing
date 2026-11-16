# Bridges Manufacturing staging

Status: source prepared; NOT provisioned. Supabase rejected the third active free project (two-project account limit). Production and Learning Studio were not paused or modified. Resolve capacity before deployment. Billing-unit implementation is not included in this setup.

## Isolation

- Production: main branch, existing Worker and xftcsuqexzdpgoqeneem database.
- Staging: change-in-billing-units branch, bridges-manufacturing-staging Worker, NEW Supabase project in the same organisation, us-east-2.
- Never connect staging to production or Learning Studio. Build validation rejects those project URLs and refuses missing staging configuration. Never put service_role or secret keys in VITE variables.
- Use generated sample people, clients, attendance and production. Do not copy production rows, auth users, sessions or payroll. Test staff receive separate credentials. Restrict the staging URL to approved testers before use.

## Provisioning checklist

1. Resolve the active-free-project limit without pausing or upgrading anything without Haroon's decision.
2. Create the staging project. Capture the production schema through a schema-only export, including private schemas, functions, grants, policies, triggers, extensions and storage bucket configuration. Review it to exclude data, role passwords, platform-owned auth/storage schema definitions and production URLs. Apply only to staging. Reconcile with migration history; do not replay historical seed/reset scripts.
3. Create separate private manufacturing-files storage and test users. Deploy shop-floor-login and admin-users Edge Functions with staging-only service credentials. Verify email/origin settings and maintenance guard against staging. No production credentials are copied.
4. In Cloudflare create a SEPARATE Worker linked to this repo and change-in-billing-units. Build: npm ci && npm test && npm run build. Deploy: npx wrangler deploy --config wrangler.staging.jsonc. Set VITE_APP_ENV=staging, VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY as build variables. Production remains main with its original wrangler.jsonc. Configure approved-tester access before enabling use.
5. Confirm the staging banner is visible on Manufacturing and Accounts. Inspect network requests: all database, auth, files and functions must target the staging project. Confirm version.json commit matches staging HEAD. Test maintenance on staging only, plus role restrictions and complete sample workflows.
6. Desktop staging needs a separate origin, user-data folder, mutex and update channel. Do NOT use the production desktop binary to test staging. A separate build is pending the real staging URL. The production Windows release workflow is now explicitly main-only, including manual dispatch, so staging cannot overwrite its public updater assets.

## Outstanding release protection

Stable production commit at setup: 681a64bb0e15daa1f8591719f77f25bee36a0d5c. Create the before-v2.0 release tag and take a verified production backup through approved provider tooling before any production migration. No production data backup or schema clone has been performed by this preparation.

## Promotion

Review a pull request, run staging tests, approve migrations, then merge to main. Production configuration stays pinned to its existing database. Test-only environment variables are never copied to production. Keep existing production columns compatible; preserve historical scans. Validate rollback with the previous production deployment before the v2.0 release.
