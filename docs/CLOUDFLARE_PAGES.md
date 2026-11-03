# Cloudflare Pages deployment

The React/Vite frontend deploys as static assets. All existing database, Auth,
Storage, RPC permissions and staff accounts stay in the separate Manufacturing
Supabase project `xftcsuqexzdpgoqeneem`.

## Connect GitHub

In Cloudflare, open Workers & Pages and create a **Pages** project using the
existing GitHub repository `haroonrasheed1607-a11y/bridges-manufacturing`.
Select only that repository when granting GitHub integration access.

| Setting | Value |
| --- | --- |
| Project name | `bridges-manufacturing` (if available) |
| Production branch | `main` |
| Framework preset | React (Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Repository root |
| Node version | 22, supplied by `.node-version` |
| Production environment variable | `BRIDGES_VERSION_SEED=1.2` |

`1.2` is the last Netlify version observed during migration. If a newer release
has been published before setup, set the seed to that published version instead.
Keep automatic production deployments enabled. Enable **Build cache** in Pages
settings so the version counter persists in npm's cached directory. If the UI
allows enabling cache only after project creation, enable it before the next build.
Preview builds have a separate counter for each branch. Set
`CF_PRODUCTION_BRANCH` only if the production branch differs from `main`.

## Version continuity

Cloudflare supplies `CF_PAGES_BRANCH` and `CF_PAGES_COMMIT_SHA`. The build records
the commit in `version.json` and increments the cached version automatically,
including a redeploy of the same commit. The seed carries the previous host's
version forward without changing the source baseline. Production and preview
counters do not affect each other. The Vite metadata, footer and release popup
use the same generated release value as on Netlify.

Cloudflare can expire build caches after seven days without reads. If the cache
expires or is cleared, update `BRIDGES_VERSION_SEED` to the latest published
version before the next build to prevent numbering from going backwards. A
cached build counter is not a durable release ledger.

## Routing, headers and authentication

Vite copies `public/_headers` into `dist`. Cloudflare applies the security and
cache headers there; it does not read `netlify.toml`. Pages' default SPA fallback
serves `index.html` for frontend routes when no top-level `404.html` exists.
No Pages Functions, paid Worker or backend migration is required.

The current app uses direct password authentication with Supabase; no OAuth or
email callback URL is involved. Staff will sign in again on the new domain.
If callback-based authentication is added later, configure that domain in
Supabase's allowed redirect URLs. Never add service-role keys or staff passwords
to Cloudflare's frontend build settings.

## Verify before switching users

Confirm the Cloudflare deployment succeeds, open its returned `pages.dev` URL,
and verify username sign-in for admin, boxsetup and boxscan. Check that each
shop-floor login sees only its permitted task, that refresh preserves the page,
and that the build's `version.json` reports the deployed GitHub commit. Inspect
response headers on `/`, `/version.json` and an asset. Keep Netlify until this
verification is complete; its `netlify.app` address cannot move to Cloudflare.
