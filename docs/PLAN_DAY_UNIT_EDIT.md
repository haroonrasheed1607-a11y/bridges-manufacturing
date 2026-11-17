# Planned for the day — admin BU/Scan edit

Staging first; production promotion requires Haroon's approval.

- Admins can save BU/Scan directly when the selected job has no scans on the selected planned day.
- If that day's scanned BU is strictly below 10% of the selected job's total BU, an admin can confirm Reset day & save. Exactly 10% and above are locked.
- The reset removes only this job's selected-day scan records from active production, billing and pay. Earlier days, other jobs and attendance are preserved. Overall job progress may remain nonzero because earlier days remain.
- A private, RLS-protected audit stores original scan/rate snapshots and completed box records. Completed single-use labels affected by the reset are retired rather than reopened; same-day bookings tied to those labels are archived and removed. New labels are needed for those boxes.
- Old reusable scan request IDs are blocked after reset, preventing a delayed retry from resurrecting discarded production. Saves are idempotent and check both order revision and scan fingerprint under the same order lock used by scanners.
- BU/Scan remains a work-order setting shared with its active assignments. Changing it affects subsequent scans; recorded work on other days retains its original units and rates.
- Closed/revoked plans, legacy piece-based jobs, multi-sub-job work orders and inconsistent cross-day single-use records are locked. Non-admins see a disabled field.

Apply database/v2/plan-day-unit-edit.sql under maintenance mode. The staged source includes the retired-box booking fix already. Run database/v2/plan-day-unit-edit-tests.sql; fixtures roll back. When promoted with approval, the release guard requires bridges.release_approval=plan-day-approved in the migration transaction.
