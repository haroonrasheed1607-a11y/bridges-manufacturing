# Bridges Manufacturing

Independent manufacturing workspace for Bridges, with a Netlify frontend and a
separate Supabase database (`xftcsuqexzdpgoqeneem`). See [API_SETUP.md](API_SETUP.md)
for API contracts, access rules, administrator setup and remaining schema work.

## Development

```sh
npm ci
npm run dev
npm test
npm run build
```

Netlify uses `npm run build` and publishes `dist`. The existing version-cache
plugin and automatic build versioning remain enabled. Source baseline and
`release.json` minimumVersion are unchanged. Do not commit generated `dist`,
`.netlify`, node_modules or credentials.

## Source layout

- `src/App.jsx`: screen selection and role-aware routing.
- `src/components/MainLayout.jsx`, `Navbar.jsx`, `Footer.jsx`: shared layout.
- `src/state/ManufacturingContext.jsx`: one shared provider for API data and writes.
- `src/features/`: orders, customers, work plans, production, job board, people,
  quality, packing, warehouse and delivery screens.
- `src/api/`: session handling, authenticated RPC requests and private file URLs.
- `src/domain/`: workflow, quantity, timing and capacity calculations.
- `database/`: deployed schema/API definitions, demo seed and rollback tests.
- `docs/DATABASE_DESIGN.md`: target database design and current implementation limits.

Core data is shared through Supabase; there is no automatic local-data fallback.
The frontend refreshes visible data every 15 seconds and on window focus. The
first approved staff account is required before signing in. Only a public
publishable API key is shipped to the browser.

Some existing JSX entry paths are retained as compatibility exports; all use the
same current feature implementations and shared context. Legacy demo and pure
workflow fixtures remain for tests and controlled migration of the prototype.

## Verification and limits

Client/session/state tests and workflow tests run with `npm test`; versioning
regressions remain in the same suite. `npm run build` generates the deployable Vite
site. Database integration tests have run in a rollback transaction against the
separate Manufacturing project. Security checks found no Supabase security-advisor
issues. Live authenticated HTTP/browser testing still needs an approved staff
account; no temporary privileged account was created.
