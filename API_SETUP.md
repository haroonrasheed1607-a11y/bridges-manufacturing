# Shared database APIs and Netlify frontend

## What is deployed

Supabase project: **Bridges Manufacturing** (`xftcsuqexzdpgoqeneem`, US East 2).
Project URL: https://xftcsuqexzdpgoqeneem.supabase.co

The database now has 15 application tables with row-level security, protected
write functions, private picture/signature storage, and sample data across all
ten board stages. The initial administrator account is provisioned. The username `admin` is mapped to an internal Supabase email identity; its password is not included in source code.

The React provider now loads from Supabase instead of browser-only business data.
It refreshes every 15 seconds while visible and when the window regains focus.
This is polling, not a WebSocket subscription. It queues writes, waits for server
confirmation, and rejects stale order revisions. Browser session tokens remain
local to the browser; the public publishable key is safe to include in Netlify.
No service-role or database password is included in this package.

## Netlify deployment

Place this package's contents at the root of the Manufacturing repository.
Connect that repository in Netlify. `netlify.toml` supplies:

- Build command: `npm run build`
- Publish directory: `dist`
- Node.js: 22
- SPA fallback: `/index.html`

The repository uses its pinned React dependencies and Vite. Run `npm ci` before
building locally. Automatic versioning and the Netlify version-cache plugin are preserved. Supabase is the API and database host.
Netlify hosts static frontend files. Deploying this package does not redeploy SQL.

For local development, run `npm run build` followed by `npm start`.
The standalone preview also connects to the shared backend and requires staff
sign-in. It no longer silently falls back to local data on a network error.

## Administrator and staff accounts

The first administrator account has been created and approved at the user's request.
Use `admin` in the **Username or email** field. The authentication password is stored
only as a hash in Supabase; it is not embedded in the frontend or this repository.

For additional staff, create the user in this project's Supabase Authentication
section and grant the appropriate protected `staff_profiles` role. The included
bootstrap script is for explicit administrator setup, not a public signup path.

Do not expose SQL-editor/database credentials to the frontend. Do not assign
roles through user-editable authentication metadata. Add other staff profiles
through a trusted administrator operation. Coach profiles link `person_id` to a
coach record. Station profiles are production-only.

## API contracts

All endpoints are `POST /rest/v1/rpc/<name>`. Send the project's publishable key in
`apikey` and the staff access token in `Authorization: Bearer <token>`.

| Endpoint | Arguments | Access and response |
| --- | --- | --- |
| `app_my_profile` | `{}` | Current authenticated user's own approval/role |
| `app_get_workspace` | `{}` | Shared orders, customer names and workforce, filtered by role |
| `app_save_customer` | `p_name` | Admin/manager; refreshed workspace |
| `app_save_person` | `p_person` | Admin/manager; refreshed workspace |
| `app_save_booking` | `p_booking` | Admin/manager; refreshed workspace |
| `app_release_booking` | `p_id` | Admin/manager; refreshed workspace |
| `app_save_order` | `p_order`, `p_revision`, `p_message` | Admin/manager; refreshed workspace |
| `app_create_box` | `p_order_id`, `p_work_id`, `p_box` | Manager, assigned coach or station; atomically creates box and booking |
| `app_complete_box` | `p_box_id`, `p_pieces` | Manager, assigned coach or station; atomic completion and capacity release |

The response shape deliberately matches the existing UI:

```json
{
  "orders": [{"id":"ORD-...","_revision":1,"workOrders":[],"history":[]}],
  "customers": ["Customer name"],
  "workforce": {"people":[],"bookings":[]}
}
```

Orders carry `_revision`; a stale save returns a conflict rather than replacing a
newer save. The frontend refreshes the record after a conflict and asks the user
to retry. Scans are committed on the server with locks and reject double counting.
A network failure after a scan may require refreshing/scanning again to see whether
it was committed; a repeated scan never counts the same box twice.

## Pictures and printing

Order pictures, assembly-part pictures and on-screen signatures upload to the
private `manufacturing-files` bucket. Database values contain stable storage
paths; the client obtains expiring signed image URLs and caches them temporarily.
Manager uploads are allowed before a new order is committed; a failed create can
leave an unreferenced object. Orphan cleanup is a follow-up operational task.

Delivery challan printing waits for its metadata to save. Box creation now waits
for the server; choose the explicit Print QR button after assignment so browser
popup rules do not block printing. Native printer testing is still required.

## Scope of this first integration

Core orders, work orders, sub-jobs, boxes, people, bookings, quality and packing
checks have relational storage and working APIs. The existing UI's work-plan
metadata, assembly instructions, warehouse record and whole-order delivery/challan
record retain JSON fields for compatibility. Internal display IDs remain text to
preserve existing preview references.

This is not the complete future schema in the design document. Automatic repeat
order generation, calendar-exception editing, normalized partial deliveries,
immutable issued-challan revisions, handwritten-challan verification and an
in-app staff administration screen remain follow-up work. The `order_schedules`
and calendar tables are foundations; no scheduled recurrence job has been enabled.

Previously saved browser-only business data is not automatically imported. It is
not deleted. Export and review it separately before a controlled import.

## Verification completed

- SQL integration tests against this project's actual database, inside a rollback:
  customer/person writes, order read/write, existing work-order roundtrip, stale
  revision rejection, box assignment/completion, duplicate scan rejection, booking
  release, station/coach scoping and denial for unapproved accounts.
- Row-level security enabled on every application table; anonymous workspace RPC
  access denied.
- Supabase security advisor returned no findings; the missing staff-person index
  was added. New indexes may be reported as unused until usage grows.
- Node tests: API request/session protocol, refresh deduplication, private file
  references, stage calculations, demo quantities, scan rules and challan quantities.
- Source syntax and ES-module imports verified; standalone and Netlify builds generated.

The configured administrator's real password sign-in, active staff role and
read-only shared workspace retrieval have been verified over HTTP. The test
session was signed out afterward. Full browser/printing checks remain pending;
a local browser engine could not be downloaded in this environment.

## Shop-floor access
Apply `database/shop-floor-roles.sql` after the existing schema and hardening scripts. The `box_setup` role creates, assigns and prints boxes; `box_scanner` records completed pieces and completes boxes. Both see only production orders, without customer contact or delivery records, and cannot edit orders or staff. Existing admin, manager, coach and legacy station access is preserved. Login aliases `boxsetup` and `boxscan` resolve to separate Supabase identities at `@bridges-manufacturing.local`; provision credentials separately and never commit passwords.

Cloudflare Pages deployment settings and verification: see [docs/CLOUDFLARE_PAGES.md](docs/CLOUDFLARE_PAGES.md).

## Admin users

Deploy `supabase/functions/admin-users/index.ts` as Edge Function `admin-users`
with JWT verification enabled. The handler also validates the bearer token through
Auth and checks the caller's active admin profile on every request. It uses the
server-provided service role key only inside the Edge Function. The browser sends
only the current staff session. `list` returns paginated account metadata;
`reset` sets a new password through Auth's admin API and returns only success.
Existing passwords and hashes are never returned or stored in application data.
Passwords must contain at least 8 characters and fit in 72 UTF-8 bytes. Existing
sessions are not revoked by this screen. No roles or approvals can be changed here.

## Shared Shop Floor buttons

The public `shop-floor-login` Edge Function deliberately provides password-free
access to the two fixed shop-floor accounts. Anyone with the app link can use
scanner or boxer access. Admin and other staff retain password sign-in. The
handler accepts only a mode, checks the fixed account has its expected active
restricted profile, and creates a session through Auth; it never accepts an
arbitrary user, email or role. Disabling either staff profile disables its button
server-side and denies existing sessions' RPC access. Shared actions are recorded
under boxscan or boxsetup; they do not identify the individual holding the phone.
Deploy this function with gateway JWT verification off because it is a login
endpoint, while leaving admin-users JWT verification on. Server credentials never
enter frontend files. Existing box creation/completion permissions still apply.
