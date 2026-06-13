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

## Revisit when

- Beta needs its own deployed web URL → add a second Vercel project/scope with
  `NEXT_PUBLIC_APP_ENV=beta`.
- CI-driven deploys are added → gate prod behind a protected GitHub Environment
  with manual approval; dev can auto-deploy on `main`.
