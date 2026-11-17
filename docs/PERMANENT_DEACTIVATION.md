# Permanent deactivation — staging release

Production promotion requires separate approval. Apply database/permanent-deactivation.sql after the V2 and plan-day migrations, under the system-update gate. The migration contains explicit function definitions so reviewers can inspect each operational read path.

## Retention and activity

Work orders, sub-jobs, boxes, bookings, reusable assignments, scan approvals, coach links and both scan ledgers retain their original rows. They have active, deactivated_at, deactivated_by and deactivation_reason columns. Existing assignment flags keep their values; no historical production is automatically reclassified.

The three formerly destructive routines now UPDATE activity instead of DELETE. Parent deactivation closes dependent work and labels. Business-root delete triggers and restrictive foreign keys prevent physical removal through cascades. Trigger guards reject restoration; there is no restoration endpoint or UI. Removed plan IDs are retained privately so a stale save cannot reopen an old plan. A new plan or label requires a new ID.

## Calculations and scanning

Private security-invoker active read models supply operational work, capacity and scan queries. These views have no API-role access. Historical production joins retain inactive assignment links: closing an assignment must not cancel legitimate completed work. Only deactivated scan rows leave production and payment totals. The billable accumulation trigger subtracts units on active-to-inactive transitions; daily reset also adjusts the existing legacy completed counter. Recorded rates and earlier-day production remain intact.

Existing reset eligibility, permissions, revision checks and replay protection remain. Reset single-use boxes stay stored but inactive and need new labels. Inserts and changed parent references are checked against active parents under a row lock. Inactive scan records cannot be edited.

## History

The new app_configuration_history_status endpoint retains date, search and server pagination and adds Active / Inactive / All filtering plus state, timestamp, actor ID and reason columns. Unsupported activity views are treated as active; they do not acquire new deactivation controls. Compatibility History remains readable. A pre-existing reusable-only History projection omission is corrected.

## Validation

84 app tests plus staging build. Rollback database suites cover retained rows, denied restoration/deletion, below-10% reset, earlier-day preservation, exact threshold, stale requests, inactive History, pagination, sub-job replacement, work-order deactivation, scan and assign, dashboard, timesheets and accounts reporting. No production configuration or records changed.

For production, run the approved migration with transaction-local bridges.release_approval=deactivation-approved. Verify definitions, privileges and pre/post business-record fingerprints; do not run mutation fixtures against production. Disable maintenance only after verification succeeds.
