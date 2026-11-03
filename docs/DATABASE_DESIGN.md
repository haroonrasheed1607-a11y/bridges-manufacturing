# Bridges Manufacturing — Database Design

Status: phase-one APIs and core database deployed in project xftcsuqexzdpgoqeneem; first staff administrator and Netlify deployment pending.

Implementation note: the full layout below remains the target design. The current integration uses 15 application tables and compatibility JSON for work-plan metadata, warehouse and whole-order delivery documents. Internal display IDs remain text. Partial-delivery transactions, recurrence generation, calendar-exception editing, immutable challan revisions and handwritten acceptance verification are not yet implemented.
Confirmed defaults: November 2, 2026.

## Confirmed business rules

- Independent from Bridges Learning Studio, including its own database, authentication and file storage.
- Login roles: Admin, Manager, Job Coach and Production Station. Individuals do not need accounts.
- Coaches see their assigned work orders and may assign boxes and record production. Managers handle planning and approvals.
- Monday–Friday, six working hours/day by default; working hours can be overridden by individual and work order. Record holidays and absences.
- Repeat orders produce drafts for review. They do not automatically commit production.
- Partial deliveries are permitted; each delivery has its own challan.
- Customer acceptance can be an on-screen signature or an uploaded handwritten signed challan, verified by an authorized staff member.
- Start with clearly marked demo records; real records can be imported later.

## Record conventions

Use UUID primary keys and readable, unique references for orders, work orders, boxes and challans. QR codes contain the unique box reference, not a person's name. Quantities are integer pieces; estimated labour is integer seconds; booked working hours use numeric values. Dates use `date`, event times use `timestamptz`, and operational calendar calculations use `America/Chicago`.

Business records have `created_at`, `created_by`, `updated_at` and `is_demo`. People and customers can be archived; completed production, issued challans and audit history are retained. User identities come from authentication; passwords are not stored in business tables. Duplicate person names are allowed; a unique person reference identifies each individual.

## Tables and fields

`PK` means primary key. `FK` means a link to another table. All `id` fields are UUID primary keys unless stated otherwise. Required fields and allowed values will become database constraints in the implementation.

### 1. Users and people

| Table | Main fields | Rules |
| --- | --- | --- |
| `user_profiles` | `id` (FK authentication user), `display_name`, `role`, `person_id` (nullable FK people), `active` | Roles: admin, manager, coach, station. Staff cannot change their own authorization role. |
| `people` | `id`, `person_code`, `name`, `kind`, `hours_per_day`, `active` | Kind: individual or coach. Default 6 hours/day; greater than 0 and no more than 24. |
| `calendar_settings` | singleton `id`, `timezone`, `working_weekdays`, `default_hours_per_day` | America/Chicago; ISO weekdays 1–5; default 6 hours. |
| `calendar_exceptions` | `id`, `person_id` (nullable FK), `date`, `available_hours`, `reason` | A null person means site-wide holiday/change. Individual exception overrides the site calendar for that day. |

People are work participants; user profiles are access accounts. A coach profile links to a coach person record. A station account records the operator/device identity without impersonating the individual doing the work.

### 2. Customers and order requests

| Table | Main fields | Rules |
| --- | --- | --- |
| `customers` | `id`, `customer_code`, `company_name`, `contact_name`, `phone`, `email`, `delivery_address`, `active` | Customer code unique. Address retained as structured fields or a validated address object. |
| `order_schedules` | `id`, `customer_id`, `title`, `quantity`, `pieces_per_pack`, `interval_days`, `next_due_date`, `active` | Positive interval; weekly = 7, fortnightly = 14, custom = X calendar days. |
| `orders` | `id`, `order_number`, `customer_id`, `schedule_id` (nullable), `occurrence_date` (nullable), `title`, `quantity`, `pieces_per_pack`, `required_delivery_date`, `expected_delivery_date` (nullable), `stage`, `review_status`, `customer_snapshot` | Quantity and pieces/pack are positive integers. One occurrence per schedule/date, enforced uniquely. |

A one-time order has no schedule. Every repeating occurrence is a distinct order with its own deadline, production and deliveries. New recurring occurrences have `review_status = draft`; approval is required before work-order finalization. Calendar recurrence does not skip weekends automatically; production planning uses working days.

Customer snapshots preserve the customer details used for an order. Issued delivery documents preserve their own independent snapshots.

### 3. Work planning

| Table | Main fields | Rules |
| --- | --- | --- |
| `work_orders` | `id`, `work_order_number`, `order_id`, `job_type`, `description`, `instructions`, `quantity`, `pieces_per_pack`, `seconds_per_piece`, `pack_overhead_seconds`, `hours_per_day`, `production_start_date`, `required_delivery_date`, `expected_delivery_date`, `people_assigned`, `packs_per_sub_job`, `plan_version`, `approved_at`, `approved_by` | Types: assembly or packaging. Defaults: 30 seconds/piece, zero pack overhead, 6 hours/day. Packs/sub-job editable with a computed suggestion. |
| `work_order_assignments` | `id`, `work_order_id`, `coach_id`, `assigned_at`, `assigned_by`, `ended_at`, `confirmed_at` | Coach must be a coach person. One current lead coach per work order; retain previous assignments. |
| `work_order_steps` | `id`, `work_order_id`, `step_number`, `part_name`, `instruction`, `attachment_id` (nullable), `plan_version` | Unique step number within a work-order plan version. Preserves the assembly order. |
| `sub_jobs` | `id`, `sub_job_number`, `work_order_id`, `sequence_number`, `quantity`, `packs_target`, `plan_version` | Whole packs grouped into sub-jobs; the final sub-job may contain a partial pack. |

Finalizing the order checks that work-order quantities add up to the ordered quantity, and each work order's sub-jobs add up to its quantity. These are cross-record checks executed transactionally, rather than independent per-row checks.

After production begins, plan changes require controlled revision; completed boxes must retain their original instruction/quantity references. Regenerating sub-jobs must not delete boxes or historical production.

### 4. Capacity and production

| Table | Main fields | Rules |
| --- | --- | --- |
| `bookings` | `id`, `person_id`, `work_order_id`, `start_date`, `end_date`, `planned_seconds`, `status`, `notes` | Status: booked, released or completed. Holds overall reserved labour. |
| `booking_allocations` | `id`, `booking_id`, `date`, `planned_seconds` | Per-working-day allocation; totals must equal booking reservation. Supports accurate day-by-day capacity. |
| `boxes` | `id`, `box_code`, `sub_job_id`, `planned_pieces`, `work_date`, `status`, `plan_version`, `created_by` | Box code globally unique within this project. Status: assigned, completed or cancelled. |
| `box_assignments` | `id`, `box_id`, `person_id`, `booking_id` (nullable), `assigned_at`, `assigned_by`, `ended_at` | Exactly one active individual per assigned box. Keep reassignment history. |
| `production_records` | `id`, `box_id`, `assignment_id`, `completed_pieces`, `completed_at`, `recorded_by`, `source`, `reverses_record_id` (nullable), `reason` (nullable), `request_key` | Source: scanner, manual or correction. Completion is recorded once; corrections are controlled reversal/replacement entries. |

A box consumes existing reserved hours through its linked booking where available. If it represents additional work, the assignment transaction creates an additional reservation. Do not count the same labour once as a booking and again as a box reservation.

Box completion atomically checks the active assignment, the production stage, quantity bounds and prior completion. Lock the relevant box/sub-job so concurrent scans cannot overcount. A unique request key makes retried requests safe. Reprinting uses the existing box code and does not create a box.

Completed pieces are derived from the production ledger, including corrections. Legacy manually entered sub-job progress is imported explicitly as opening progress, not silently duplicated as new box completions.

When fewer pieces are completed than planned, the shortage remains unallocated and can be assigned to a replacement box. Effective allocation is the sum of planned pieces on active boxes plus actual completed pieces on completed boxes, adjusted by approved corrections. It must never exceed the sub-job quantity.

### 5. Quality, packing and stock

| Table | Main fields | Rules |
| --- | --- | --- |
| `quality_checks` | `id`, `work_order_id`, `method`, `inspected_pieces`, `failed_pieces`, `inspector_id`, `notes`, `checked_at` | Random audit or 100% check. Failed pieces between zero and inspected; 100% check covers the full work-order quantity. |
| `packing_checks` | `id`, `work_order_id`, `correct`, `checker_id`, `notes`, `checked_at` | Keep every check; the latest applicable passing record releases the work. |
| `warehouse_locations` | `id`, `code`, `name`, `active` | Named warehouse/rack locations. |
| `warehouse_movements` | `id`, `work_order_id`, `delivery_item_id` (nullable), `movement_type`, `pieces`, `location_id`, `recorded_by`, `occurred_at`, `reference` | Types include sent, received, dispatched, returned and approved adjustment. |

Quality failures hold progression until corrective work and a new passing inspection are recorded. Warehouse balance comes from received/dispatched/returned/adjustment movements; marking goods sent to warehouse does not make them received stock. Dispatch must not exceed available stock.

### 6. Delivery and accounting records

| Table | Main fields | Rules |
| --- | --- | --- |
| `deliveries` | `id`, `delivery_number`, `order_id`, `method`, `destination_snapshot`, `status`, `approved_at`, `approved_by`, `dispatched_at`, `accepted_at`, `acceptance_method`, `signatory_name`, `verified_by`, `verified_at` | Method: pickup or drop. Status: draft, approved, dispatched, accepted or cancelled. |
| `delivery_items` | `id`, `delivery_id`, `work_order_id`, `pieces`, `pieces_per_pack`, `pack_count` | Supports partial dispatches. Cannot exceed stock or the order's remaining deliverable quantity. |
| `delivery_challans` | `id`, `challan_number`, `delivery_id`, `issued_at`, `issued_by`, `invoice_po_reference`, `vehicle_reference`, `document_snapshot`, `pdf_attachment_id`, `signed_attachment_id`, `voided_at`, `void_reason` | Stable unique number; one current issued challan per delivery. Reprints preserve the issued snapshot. |

An issued challan is immutable. Accounts/Customer/Office are print copies of the same issued record, not three deliveries. Corrections require a void/reissue trail. Never overwrite the original document when uploading a signed return.

Acceptance requires either a saved on-screen signature or an uploaded signed challan verified by an authorized manager/admin. A partial delivery's acceptance does not complete the whole order. Complete the order only when all required pieces have been dispatched and accepted and all exceptions are resolved.

Invoices, payments and accounting ledger entries are outside this initial scope. Challans can store an external invoice/PO reference.

### 7. Files and history

| Table | Main fields | Rules |
| --- | --- | --- |
| `attachments` | `id`, `bucket`, `object_path`, `original_name`, `mime_type`, `size_bytes`, `purpose`, `order_id` (nullable), `work_order_id` (nullable), `delivery_id` (nullable), `uploaded_by` | Explicit foreign keys identify the owning record; purpose and ownership combinations are validated. Storage paths are private. |
| `stage_events` | `id`, `order_id`, `stage`, `event_type`, `actor_id`, `occurred_at`, `request_key` | Entered, acted_upon, reopened or exited; retain history across retries/rework. |
| `activity_log` | `id`, `order_id` (nullable), `actor_id`, `entity_type`, `entity_id`, `action`, `details`, `occurred_at` | Append-only history written by controlled database operations. |

Images, PDFs and signatures live in private object storage; their metadata and relationships live in tables. Uploaded files use unique object paths. Access checks follow the owning order/work order and the logged-in user's role, not just whether the user is signed in.

## Ten workflow stages

1. New Orders
2. Work Orders
3. Assign Work Order
4. Start Production
5. In Production
6. Quality Check
7. Packing
8. Warehouse
9. Delivery
10. Order Completion

Store these as explicit named stage codes, replacing the preview's mixed numeric stage/flag representation. Record both stage entry and action completion so the job board can distinguish a completed action awaiting transition from an action still pending.

For each column, `done / (done + pending)` counts eligible orders that have reached that stage. Orders not yet at that stage are excluded. Orders already beyond it count as done. Reopened actions count as pending until resolved. Stage percentages and dashboard totals are computed views, not manually edited values.

## Access rules

| Operation | Admin | Manager | Coach | Production Station |
| --- | --- | --- | --- | --- |
| Manage staff logins and authorization | Yes | No | No | No |
| Customers, orders and planning | Yes | Yes | Read assigned work context | No |
| Approve plans and move management stages | Yes | Yes | No | No |
| Assign coach to a work order | Yes | Yes | No | No |
| Assign boxes and reserve individual work | Yes | Yes | Assigned work orders only | In-production work only |
| Scan completion and print box labels | Yes | Yes | Assigned work orders only | In-production work only |
| Quality, packing and warehouse approvals | Yes | Yes | No initially | No |
| Delivery, signed-challan verification | Yes | Yes | No | No |
| Production corrections | Yes, audited | Yes, audited | Request correction | No |

Station accounts receive only the operational fields needed to select production work, assign a box, scan completion and print a label. They do not receive customer contact/address data, delivery documents or staff administration permissions. Implement minimal operational views/RPCs rather than exposing unrestricted rows and hiding fields in the UI.

Enable row-level security on exposed tables. Bootstrap the first admin through a trusted server/database operation. New signups do not automatically receive an application role. Ordinary staff cannot edit role or account-active fields. Business role checks use protected database records, not user-editable authentication metadata. Keep the application's privileged API keys out of browser code.

## Transactional operations

Implement controlled operations for:

- Create an order and generate an idempotent repeat draft.
- Finalize a plan after checking quantities, instructions, sub-jobs and capacity.
- Assign/confirm a coach and start production.
- Assign a box with a reservation, then complete it safely from a scanner.
- Correct production with an audit reason and consistent quantity/capacity updates.
- Record inspection, packing and warehouse movements.
- Approve/dispatch a partial delivery and issue its immutable challan.
- Verify acceptance and complete an order when all delivery obligations are fulfilled.

Use security-invoker operations where practical, with explicit role checks and narrowly granted writes. If privileged internal functions are required, keep them in a non-exposed schema, restrict execution, validate the current user and fix their search path. Reporting views must respect the caller's access rules.

Index foreign keys, box code lookups, current stage/deadline searches, active coach/person assignments, dated booking allocations and stock movement links. Use database constraints for unique references, positive quantities and valid date ranges; use locked transactional operations for cross-record balances.

## Implementation and verification

1. Confirm the owning Supabase organization, then create a separate `Bridges Manufacturing` project after any required cost confirmation.
2. Inspect the new project's existing schemas before deploying tables.
3. Apply versioned schema changes, access policies and private storage rules.
4. Bootstrap an admin and seed clearly marked demo data covering all ten stages.
5. Test role restrictions, duplicate/concurrent scans, reservations, shortages, partial deliveries, signed acceptance, recurrence deduplication and challan reprints.
6. Run security/performance advisors and resolve findings before connecting the UI.
7. Map the current shared React provider to database operations and migrate browser data explicitly. Preserve opening progress and readable references.
8. Test the complete workflow across at least two signed-in devices.

## Current setup status

The separate Bridges Manufacturing project is active in US East 2 under haroonrasheed1607 Org. Core read/write APIs, protected production operations and private file storage are deployed. Sample data spans all ten stages. The existing Learning Studio project remains separate. The first approved staff account and actual Netlify deployment remain to be configured. See API_SETUP.md in the source package for exact contracts and tested limits.
