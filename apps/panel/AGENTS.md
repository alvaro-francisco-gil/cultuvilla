# apps/panel — the founders' panel

An internal tool for the two people running Cultuvilla. It reads the business
registry in [project/](../../project/) and nothing else. **No villager ever sees
it, and no product feature belongs here.**

Root [AGENTS.md](../../AGENTS.md) governs the codebase; this file governs this
app. It is Vite + React, not Expo — deliberately not part of `apps/mobile`.

**Live at https://cultuvilla-panel.web.app** (dev project, `villa-events`).

## Why it is a separate app

It used to be a screen inside `apps/mobile` at `/admin/negocio`, and that was
wrong for two reasons. The tolerable one: a tool for two people has no business
travelling in the bundle villagers install. The serious one: **the app-admin
route guard hid the screen, but the snapshot JSON still shipped in the public web
bundle**, so anyone loading the web build could fetch it. "Admin dashboard"
promised a privacy it did not have.

So the data path is the whole design:

```
project/**.md  →  pnpm business:snapshot  →  functions/src/business/snapshot.json
                                                   ↓  (bundled into functions, not served)
                                          getBusinessSnapshot callable
                                                   ↓  only if admins/{uid} exists
                                              apps/panel  ← no data compiled in
```

`apps/panel/dist` is a shell. Nothing in it reveals the registry.

## Dev only, on purpose

One hosting target, on the dev project, with **no release path**. Its content
comes from git rather than from an environment, so a beta and a prod copy would
show the same thing — and keeping it off prod means a broken panel can never
block the app's promotion. That is also why
[deploy-panel.yml](../../.github/workflows/deploy-panel.yml) is a separate
workflow instead of a step in `deploy-firebase.yml`.

It redeploys on pushes to `develop` that touch `project/**` or this app, because
the panel's content *is* the registry: a new convocatoria should reach it without
anyone remembering to.

## Two gotchas that a second hosting site brings

Both bit this app on its first deploy. They are per-**site**, so a custom domain
(`panel.cultuvilla.es`) needs the second one again.

**1. `--only hosting` deploys every target.** `firebase.json` has targets `app`
and `panel`, so a bare `--only hosting` tries to deploy both: it fails from
beta/prod on a target that does not exist there, and from dev whenever the panel
has not been built — turning an internal tool into a blocker for shipping the
app. Every deploy path names its target, and
[hostingTargets.test.ts](../../packages/shared/test/ci/hostingTargets.test.ts)
fails the build if one regresses.

**2. Firebase Auth does not authorize a new site's domain.** It auto-authorizes
the *default* site (`villa-events.web.app`, `villa-events.firebaseapp.com`), not
additional ones, so Google sign-in failed with `auth/unauthorized-domain` until
`cultuvilla-panel.web.app` was added under Authentication → Settings →
Authorized domains. The Firebase CLI cannot do it; the Identity Toolkit admin
API can:

```bash
# GET the config, then PATCH with the domain APPENDED — replacing the list would
# break sign-in on the app's own web build.
curl -H "Authorization: Bearer $TOKEN" \
  https://identitytoolkit.googleapis.com/admin/v2/projects/villa-events/config
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  'https://identitytoolkit.googleapis.com/admin/v2/projects/villa-events/config?updateMask=authorizedDomains' \
  -d '{"authorizedDomains":["localhost","villa-events.firebaseapp.com","villa-events.web.app","cultuvilla-panel.web.app"]}'
```

ADC alone returns 403 ("requires a quota project") — use the dev service account
key instead.

## Conventions

- **No second set of secrets.** `envDir` points Vite at `apps/mobile/.env`, so the
  panel reads the same `FIREBASE_*_DEV` values the mobile build uses. Without it
  Vite looks only in `apps/panel/`, finds nothing, and silently builds a bundle
  with an empty Firebase config — the app then renders "Falta configuración".
- **No Tailwind, no primitives.** Plain CSS, with the design-system tokens
  published as CSS custom properties at boot rather than hex values copied in, so
  the panel follows the app's palette without being able to drift from it.
- **Hardcoded Spanish.** Two users, no localisation need — the carve-out root
  AGENTS.md makes for internal admin surfaces.
- **Parse, never cast.** The panel runs the callable's response through
  `BusinessSnapshotSchema`, so a shape change says so instead of rendering as
  silently missing sections. The schema lives in `packages/shared` because it
  crosses three workspaces (generator writes, functions serves, panel reads).
- **`@cultuvilla/shared` is CommonJS and workspace-linked**, so Rollup cannot
  trace named exports through its `__exportStar` barrels. Metro handles that
  interop for mobile; Vite needs the `commonjsOptions` in
  [vite.config.ts](vite.config.ts). Expect to hit this when adding a new
  workspace import.

## Access

Anyone with a doc at `admins/{uid}` **on dev**. Not prod — this is a dev-project
app, so a prod-only admin cannot get in. A user's uid exists only after they have
signed in with Google at least once.

## Commands

```bash
pnpm panel:build     # shared build + vite build
pnpm deploy:panel    # build + deploy hosting:panel to dev

# the callable serves the data, so its own deploy is what refreshes the registry
bash scripts/firebase.sh deploy --only functions:getBusinessSnapshot --project dev
```
