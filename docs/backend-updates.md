# Backend update mode

Only turn this on while updating the Manufacturing backend. Frontend-only deployments do not need it.

Using the Manufacturing Supabase SQL Editor or database operator connection:

```sql
select manufacturing_private.set_system_update(true);
```

Commit that statement before beginning migrations. It waits for active database business requests, then the Data API rejects new business calls with HTTP 503 / PT503. Authenticated storage requests for manufacturing-files are also blocked. The public read-only app_system_status endpoint remains available for device polling.

Apply migrations and run rollback-only verification through the database operator connection, which remains available. When all required checks pass:

```sql
select manufacturing_private.set_system_update(false);
```

The web app, Accounts portal and desktop WebView automatically resume within 10 seconds. Never auto-clear the flag on a timer or after failed migrations. Do not enable it for routine frontend changes. Database operators can always clear it directly, even while devices are blocked. Existing signed storage URLs and Supabase Auth infrastructure are not disabled; business API access is paused.
