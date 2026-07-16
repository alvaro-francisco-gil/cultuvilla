# Dev / beta / prod environments

## Context

Cultuvilla needed long-lived, isolated environments so local development and PR
previews can never touch production data, and so the config shape stays
mobile-ready for a future Expo app. Operational details (the env matrix, deploy
commands, onboarding) live in [ENVIRONMENTS.md](../ENVIRONMENTS.md) — this
record captures only the decisions and why.

## Decision

- **Three Firebase projects**, aliased in `.firebaserc`: `dev` (= the existing
  `villa-events`, also `default`), `beta` (`cultuvilla-beta`), `prod`
  (`cultuvilla-prod`). Full data isolation; rules, functions, and the Next.js
  build artifact stay project-agnostic.
- **A single `NEXT_PUBLIC_APP_ENV` selector** (`dev`|`beta`|`prod`) picks the
  active env. Firebase Web SDK config is read from **per-env-suffixed env vars**
  (`NEXT_PUBLIC_FIREBASE_*_<ENV>`), resolved by
  [environments.ts](../../packages/shared/src/config/environments.ts), which is
  **fail-fast** — an unknown selector or a missing key throws at startup naming
  what's missing.
- **Explicit per-env deploy scripts** only (`deploy:*:dev|beta|prod`). There is
  deliberately no bare `firebase deploy` shortcut, so a typo can't deploy to the
  wrong project.

## Rejected alternatives

- **Six Vercel-managed `NEXT_PUBLIC_FIREBASE_*` vars per scope** (the original
  spec). Replaced because it wasn't mobile-shareable.
- **Committing the Firebase configs into source** (`environments.ts` as a
  literal map, Amendment #1). Reverted in Amendment #2 in favour of env vars for
  cleanliness — note this is a *preference*, not security: Firebase Web SDK
  config values are [public by design](https://firebase.google.com/docs/projects/api-keys).
  Anything genuinely secret lives in encrypted Vercel env vars / a secrets
  manager.

## What this binds

- App code reads Firebase only via `getFirebaseConfig(process.env.NEXT_PUBLIC_APP_ENV)`
  — never `process.env.NEXT_PUBLIC_FIREBASE_*` directly (those accesses must stay
  literal inside `environments.ts` so Next.js can inline them).
- Adding an environment means: a `.firebaserc` alias, a `_<ENV>` key set, deploy
  scripts, and a branch in `readConfig`.
- A future `apps/mobile` shares `resolveAppEnv` / `getFirebaseConfig` from
  `@cultuvilla/shared`, driven by `EAS_BUILD_PROFILE` and `EXPO_PUBLIC_*_<ENV>`.

## Amendment: branch → environment CI deploys

CI-driven deploys were added (the "Revisit when" trigger below). The three
Firebase projects are now driven by a three-tier branch model — `develop` → dev
(`villa-events`), `beta` → beta (`cultuvilla-beta`), `main` → prod
(`cultuvilla-prod`). Merging into a branch runs `.github/workflows/deploy-<env>.yml`
(a thin caller of the reusable `deploy-firebase.yml`), which deploys backend
(rules → indexes → functions) then hosting to that env.

- **Keyless auth via Workload Identity Federation**, not service-account keys: one
  WIF pool + OIDC provider per project trusts only this repo, and impersonation of
  the per-project `gha-deployer` SA is scoped to that env's branch. Chosen so the
  setup is permanent — no keys to rotate, and it survives an org later disabling
  SA-key creation.
- **Prod auto-deploys on every `beta` → `main` merge**, no manual approval. The
  `production` GitHub Environment now enforces only a branch policy (which branch
  may deploy); `main` forbids direct pushes (merge-from-`beta` only). Dev auto-deploys
  on every `develop` merge. All three envs honour the `[skip-deploy]` commit-message
  escape hatch. (The reviewer requirement was removed 2026-07-16 — it added friction
  without a second maintainer to approve.)
- Per-env Firebase web config + the WIF provider/SA references live as GitHub
  **Environment variables** (`dev` / `beta` / `production`), consumed by the
  reusable workflow. Local deploys still use `scripts/firebase.sh`.

This supersedes the original "dev can auto-deploy on `main`" note: `main` is now
production, so dev auto-deploys on `develop`.

## Revisit when

- Mobile store shipping is needed → add EAS build/submit workflows per branch
  (deliberately out of scope for the CI-deploy work, which is backend + hosting).
- Beta/prod need env-restricted API surfaces → give them their own Google
  Sign-In web OAuth client (`GOOGLE_WEB_CLIENT_ID`) and per-env restricted Maps
  keys (they currently reuse dev's).
