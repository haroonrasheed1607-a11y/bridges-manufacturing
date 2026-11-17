# Minimal workspace — staging

Frontend only. No schema, backend permissions or business data changes. Production requires separate approval.

## Main navigation

Daily Operations: Dashboard, Plan, Shop Floor, Attendance and Timesheets, filtered to existing role capabilities. Supporting Administration: Clients, Individuals, Users and Configurations, with admin-only Users/Configurations. Accounts keeps its separate sign-in and portal. Mobile menus use the same navigation model; Shop Floor's Routine Scan and Scan & Assign remain unchanged. The native printer host retains its Shop Floor-only workspace.

## Optional workflows

Configurations → Optional workflows retains the Job Board, full order register/manual requests, detailed work-order workflow and editing, capacity bookings, date-specific availability, single/bulk box setup, approved-plan printing and workflow guide. Detailed order tools are opened by selecting an order. They expose the existing stage-specific quality, packing, warehouse, delivery and challan tools when eligible; existing backend guards remain unchanged. These tools are not deleted or enabled through a global feature toggle.

Daily order links show a compact read-only production summary with Plan/Shop Floor actions. Individuals retains profile editing, repeating weekly hours, import, QR cards, status controls and timesheets, using a compact directory. The original workload calendar and booking editor are retained with the advanced prop in Optional workflows. Dashboard's Job Board shortcut now opens Plan; the empty stage breakdown is removed. Breadcrumbs reflect the new grouping and optional configuration location. No new order stages or quantities are calculated by this UI change.

Existing optional routes still work for admins inside a clearly labelled optional-workflow shell. Other roles receive their daily fallback on reload or an explanatory message for an in-session legacy link; no unauthorized optional component is mounted. Deleted/unavailable order selection returns to Plan or Shop Floor.

## Validation

Navigation model and persistence tests cover role filtering, optional route separation and native desktop restrictions. Rendering tests cover compact versus advanced Individuals, preserved edit/QR accessibility, optional hub admin access, daily order summaries and grouped navigation. Run npm test and the staging build. No database migration or system-update gate is required for this frontend-only release.
