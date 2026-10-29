# Bridges Manufacturing

First screen prototype for Bridges' **Perform a Job** workflow:

New Order → Work Order → Quality Check → Packing → Warehouse → Delivery → Order Completion.

Start with `docs/WORKFLOWS.md` for agreed requirements, proposed draft rules and outstanding decisions.

## Run

Node 22.12+ and npm are required.

```sh
npm ci
npm run dev
npm test
npm run build
```

The prototype uses fictional records and browser-local persistence under `bridges-manufacturing-screen-draft-v1`. Export data from the header before clearing browser storage. No shared backend or authentication is implemented in this screen draft. Customer signatures are local demonstration records.

## Architecture and provenance

Adapted from `haroonrasheed1607-a11y/bridges-learning-studio` at commit `0c76a99d7961891b6817b6ff15fb261aa021c2f7`. Preserves React/Vite, `App.jsx` screen selection, shared Navbar/MainLayout/Footer components, feature folders, central provider, Bridges logo, navy header, responsive layout and automatic version pipeline. Education-specific features and all original backend configuration, clients, migrations and credentials were removed. The checkout has no Learning Studio push remote.

| Folder | Responsibility |
| --- | --- |
| `src/components` | Shared layout, navigation and reusable UI |
| `src/features/orders` | Register, creation, stage workspace and workflow map |
| `src/features/work-orders` | Work definition, sub-jobs, pack calculation and lifecycle rules |
| `src/features/quality` | Random Audit and 100% Check |
| `src/features/packing` | Correct/incorrect packing checks |
| `src/features/warehouse` | Transfer, receipt and pack stock |
| `src/features/delivery` | Authorization, dispatch and customer signature |
| `src/state` | Shared manufacturing state and browser persistence |

## Repository and future production infrastructure

Source repository: https://github.com/haroonrasheed1607-a11y/bridges-manufacturing

Netlify linking is deferred. The included `netlify.toml` runs `npm run build` and publishes `dist`, using Node 22. It has no site identity and does not create a deployment. A new, independent Supabase project, production authentication and cloud storage are still pending. Never connect to Learning Studio or restore its database configuration.

Before production use, implement independent authentication, role permissions, database/storage policies, server-enforced stage rules, durable records, signature evidence and stock transactions. Agree on rework, partial deliveries and physical pack identity across successive work orders.
