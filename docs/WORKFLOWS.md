# Bridges Manufacturing — Workflow and Screen Specification

Version: first screen draft · 29 October 2026

## Scope and separation

The app covers **Perform a Job** only. It manages real orders through production, checking, packing, warehouse, delivery, and signed completion. Training and learning activities are outside scope. This is a Bridges project, independent of Edraak.

Reuse Bridges Learning Studio's React/Vite foundation, modular feature architecture, shared layout, responsive behavior, Bridges logo, and navy branding. Production infrastructure must use a separate GitHub repository, Netlify site, and Supabase project with independent authentication, database, storage, credentials, sessions, and policies. Never modify Learning Studio or connect to its data. The first screen draft uses fictional records and browser-local persistence, with no backend connection or production authentication.

## Agreed main flow

**New Order → Work Order → Quality Check → Packing → Warehouse → Delivery → Order Completion**

| Stage | Required behavior |
| --- | --- |
| New Order | Capture the customer request and create the order. |
| Work Order | Define the work, quantities, instructions, staffing, timing, and delivery dates; split work into sub-jobs and packs. |
| Quality Check | Support Random Audit or 100% Check. Record the outcome. |
| Packing | Record whether goods are packed correctly. |
| Warehouse | Track goods sent to warehouse and goods actually in warehouse. |
| Delivery | Record Ok to Deliver and Customer Pickup or Drop. |
| Order Completion | Complete only once the customer has signed. |

## Record hierarchy

**Order → one or more Work Orders → one or more Sub-jobs → Boxes or Packets**

- Order: the overall customer commitment and its lifecycle.
- Work order: a defined Assembly or Packing task. Multiple work orders can belong to one customer order.
- Sub-job: a quantity allocation within a work order, with its own description and completion count.
- Pack: a box or packet belonging to a sub-job, with a unique reference and piece count. A final pack may contain fewer pieces than the standard pieces per pack.
- A Packing work order is a production activity. The later Packing stage checks the finished goods' packaging.
- Quantities are checked within each work order. Quantities across Assembly and Packing work orders must not be added together as unique customer units; they can represent successive work on the same goods.

## Work order fields

| Field | First-draft representation |
| --- | --- |
| Customer Name | Inherited from the parent order and visible on each work order. |
| Type of Work | Assembly or Packing. |
| Number of pieces | Positive whole number. |
| Pieces per pack | Positive whole number; used to suggest boxes or packets. |
| Description | Plain-language description of the work. |
| Instructions | Step-by-step working instructions. |
| Number of people needed | Positive whole number. |
| Time per piece | Positive number in seconds per piece; unit displayed explicitly. |
| Expected delivery | Forecast date for this work order. |
| Required delivery date | Customer's required date for this work order. |

The draft also uses generated order/work-order/sub-job/pack references, an order title, pack type, activity timestamps, and notes to make records usable. These are proposed supporting fields.

Sub-job pieces must add up to their work order's quantity. Packs must add up to their sub-job's quantity. The screen suggests pack counts using ceiling(sub-job pieces ÷ pieces per pack), including any partial final pack. Estimated serial processing time is quantity × seconds per piece; the app does not assume staffing divides elapsed time linearly.

## Stage records and proposed gates for the screen draft

The following detailed rules are **proposed defaults**, not additional requirements already agreed with Bridges.

| Stage | Proposed record | Proposed rule to move forward |
| --- | --- | --- |
| New Order | Customer, order title, expected and required delivery dates | At least one fully specified work order with balanced sub-jobs. |
| Work Order | Completed pieces against each sub-job | Every sub-job has its full quantity completed. |
| Quality Check | Per work order: Random Audit or 100% Check, inspected quantity, failed quantity, inspector, notes, timestamp | Latest check passes for every work order; inspected quantity is positive and no failures. 100% Check requires all pieces inspected. |
| Packing | Per work order: correct/incorrect packing, checker, notes, timestamp | Every work order's latest packing check is correct. |
| Warehouse | All packs sent, then received into a named warehouse location | Receipt confirmed; sending alone does not count as stock in warehouse. |
| Delivery | Ok to Deliver, Pickup/Drop, destination or pickup details, dispatch timestamp | Delivery approved before dispatch; dispatch recorded before signature. |
| Completion | Customer signatory name, signature, signing timestamp | Customer signature captured for the delivered order; signature is required to complete. |

Random Audit sample size is entered by the checker. No statistical sampling standard or acceptance threshold is assumed. Any failed piece puts the work on hold; record corrective work in notes and enter a fresh check. The earlier failed check remains in history. An incorrect packing check similarly requires a fresh passing check. In the first draft, upstream work definitions are locked once the order moves into Quality Check.

Warehouse and delivery operate on the whole order in the first draft. Partial warehouse receipts, partial deliveries, shortages, cancellation, returns, multiple delivery addresses, and reopening completed orders need separate workflow decisions before production implementation.

The first draft's signature is a customer-drawn on-screen signature with a name and timestamp. It is a screen demonstration, not verified signer identity or a production signing service. Production roles, permissions, signature evidence retention, and authentication are still to be designed.

## First screens

1. **Orders overview:** searchable order list, lifecycle filters, counts, customer, required date, forecast, current stage, and New Order action.
2. **New Order:** capture customer, order title, forecast, and required date.
3. **Order workspace:** customer/order summary, seven-stage progress navigation, work-order list, current-stage actions, and activity history.
4. **Work order form:** all requested fields, sub-job quantity allocation, box/packet selection, and calculated pack previews.
5. **Production:** sub-job progress, pack references, instructions, people needed, and time estimate.
6. **Quality Check:** work-order selector, check mode, inspected/failed counts, inspector, notes, and retained check history.
7. **Packing:** correct/incorrect result per work order with checker and notes.
8. **Warehouse:** pack inventory, sent/received status, location, and timestamps.
9. **Delivery:** Ok to Deliver, pickup/drop choice, destination details, dispatch, and customer signature capture.
10. **Completion:** signed order summary, customer signature, signing time, and activity trail.

## Items to settle after reviewing the screens

- Confirm Expected delivery means forecast, distinct from the customer Required delivery date.
- Confirm who creates work orders, reports production, checks quality, accepts warehouse stock, approves dispatch, and records customer signatures.
- Confirm whether Assembly and Packing sub-jobs are parallel quantities or sequential operations for each real job; the first draft uses quantity allocations within a work order and separate work orders for successive operations.
- Confirm whether pack references identify the same physical packs through successive work orders; the draft assigns packs separately within each work order and does not deduplicate shared physical goods.
- Confirm whether all work orders must pass both quality and packing checks, or whether checks apply only to selected outputs.
- Confirm random-audit acceptance rules and the process for rework, rejected items, and repeat checks.
- Confirm whether delivery approval and actual customer handover require different people, and whether a customer signature alone suffices for final acceptance.
- Confirm partial receipts/deliveries and how they affect stock and order completion.

## First-draft delivery boundary

The screen prototype is suitable for reviewing fields and full-order workflow behavior. It stores sample data on the current browser only, with an export option. It does not provide shared production data, real logins, production permissions, server-side enforcement, or cloud signature storage. The independent GitHub repository is https://github.com/haroonrasheed1607-a11y/bridges-manufacturing. Netlify linking is deferred; independent Supabase, authentication and storage provisioning remain pending.
