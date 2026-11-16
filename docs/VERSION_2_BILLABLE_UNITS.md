# Version 2.0 — staging only

Release approved by Haroon on November 16, 2026 after staging review. Production migration is authorized only for this release; staging keeps its independent database.

## Workflow

Plan asks for Client, Item, Total Billable Units and Billable Units per Scan. New work is automatically approved, shared with Job Coaches, and ready for Scan & Assign with one sub-job. An item's physical pieces-per-unit setting does not multiply either input.

Each successful reusable scan records its chosen 1×, 2× or smaller remaining quantity in new billable columns. Single-use box completion also records billable units. Existing authorization, initial assignment waiting period, per-scan cooldown, capacity locks and idempotency protections remain active. An uncertain request retries with the same reference. Changing scan settings requires fresh load confirmation and affects future scans only.

Order and sub-job billable totals drive the percentage shown on the Job Board and order details. The shared Windows/web UI displays units; Windows label parsing accepts the new unit label while older messages retain pcs. Windows 1.11 adds the unit-label caption; the production updater remains main-only.

Accounts has a Billable Units report with date filters, 50-row pagination, client billing and individual pay. New scan rows snapshot the order's saved catalog rate for client billing and its individualRate (when present), otherwise the same existing catalog rate, for individual pay. No new rate-entry fields are introduced. Missing rates remain visibly missing; they are not treated as zero. Existing payroll includes new unit pay using scan snapshots and retains its old calculation for legacy rows.

## Storage and compatibility

Only nullable columns are added. Existing orders, scan rows and piece rates are not backfilled or converted. New unit orders initialize the existing allocation quantity fields with the same unit count as a compatibility adapter; this is a count mirror for existing locking/capacity APIs, not a physical piece conversion. Unit totals and per-scan settings have their own named columns; new scan billable quantities and rate snapshots are authoritative for reporting and payments. Legacy orders continue using their original flow. Mixed timesheets distinguish units from legacy pieces and do not combine them into a grand quantity total.

Apply the SQL files in database/v2 in this order: billable-units.sql, billable-report-projections.sql, billable-history.sql. The production operator must prefix the migration transaction with select set_config('bridges.release_approval','v2-approved',true). The guard otherwise rejects non-staging use. Current hosted staging also contains a small receipt-variable hotfix; the final source billable-units.sql includes that fix already.

## Verification

Rollback-only billable-units-tests.sql covers planning retries, changed-payload rejection, physical pack independence, single/double loads, repeat prevention, cooldowns, future scan settings, stale-load rejection, rate preservation, single-use completion, order progress, timesheets, History, billing, payroll and unauthorized access. Legacy planning, attendance, catalog authorization and discard regression scripts are also run on staging. No production records are used as fixtures.
