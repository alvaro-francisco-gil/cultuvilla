# Dev / Beta / Prod Environments — Design Spec

**Status:** Implemented — 2026-05-19
**Author:** Alvaro (with Claude)
**Worktree:** `.claude/worktrees/env-dev-prod-spec` on branch `worktree-env-dev-prod-spec`

> **Amendment #1 (2026-05-19):** The original spec used six Vercel-managed
> `NEXT_PUBLIC_FIREBASE_*` env vars per scope. After deciding to keep the
> repo mobile-ready (Expo planned), the Firebase Web SDK configs were moved
> into `packages/shared/src/config/environments.ts` and selected at build
> time by a single `NEXT_PUBLIC_APP_ENV` var. This was superseded by
> Amendment #2.
>
> **Amendment #2 (2026-05-19):** A third environment (`beta`) was added —
> "proper" multi-env layout (dev → beta → prod), Firebase free-tier so cost
> is zero. The committed-config approach was reverted in favour of
> per-env-suffixed env vars (`NEXT_PUBLIC_FIREBASE_*_<ENV>`) read from
> `.env.local` / Vercel. The single `NEXT_PUBLIC_APP_ENV` selector is kept.
> Firebase Web SDK config values are still public per
> [Firebase's docs](https://firebase.google.com/docs/projects/api-keys);
> the env-var pattern is a cleanliness preference, not a security requirement.
> §3-§9 below reflect the final design.

---

## 1. Goal

Establish three long-lived environments for cultuvilla — **`dev`**, **`beta`**, and **`prod`** — with a clean separation of Firebase projects, deploy commands, and configuration sources. Make it impossible to accidentally point local development or PR previews at non-dev data. Keep the configuration shape mobile-ready so a future Expo app can share the same env selector.

## 2. Non-goals

- **No data migration.** `villa-events` data stays where it is — that project becomes `dev`. Beta and prod start empty.
- **No second Vercel project (yet).** `beta` is a Firebase project for backend testing today. If/when beta needs its own web URL, add a second Vercel project (or use a specific branch + scope) at that time.
- **No CI deploys.** GitHub Actions stays as lint/typecheck/test/build only; deploys remain manual via `pnpm`/`firebase` from a developer machine.
- **No secrets in source.** Firebase Web SDK config values (`apiKey`, `projectId`, etc.) are public per [Firebase docs](https://firebase.google.com/docs/projects/api-keys), but we keep them in env vars anyway for cleanliness. Anything actually secret (Stripe, SendGrid, etc.) lives in Vercel's encrypted env vars / a secrets manager.

## 3. Environment matrix

| Concern                       | dev                                                              | beta                                                   | prod                                                       |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| Firebase project ID           | `villa-events` (existing)                                        | `cultuvilla-beta` (to create)                          | `cultuvilla-prod` (exists)                                 |
| Firestore region              | `europe-southwest1` (Madrid)                                     | `europe-southwest1` (Madrid)                           | `europe-southwest1` (Madrid)                               |
| `.firebaserc` alias           | `dev` (also the `default`)                                       | `beta`                                                 | `prod`                                                     |
| Cloud Functions deploys       | `pnpm deploy:functions:dev`                                      | `pnpm deploy:functions:beta`                           | `pnpm deploy:functions:prod`                               |
| Vercel project                | `cultuvilla-web`                                                  | none today (Firebase only)                             | `cultuvilla-web`                                           |
| Vercel scope                  | Development + Preview                                            | n/a                                                    | Production                                                 |
| Active-env selector           | `NEXT_PUBLIC_APP_ENV=dev`                                        | `NEXT_PUBLIC_APP_ENV=beta`                             | `NEXT_PUBLIC_APP_ENV=prod`                                 |
| Firebase config source        | `NEXT_PUBLIC_FIREBASE_*_DEV` env vars                            | `NEXT_PUBLIC_FIREBASE_*_BETA` env vars                 | `NEXT_PUBLIC_FIREBASE_*_PROD` env vars                     |
| Seed script target            | `GOOGLE_CLOUD_PROJECT=villa-events pnpm seed:municipalities`     | `GOOGLE_CLOUD_PROJECT=cultuvilla-beta …`               | `GOOGLE_CLOUD_PROJECT=cultuvilla-prod …`                   |

**Key insight:** Firebase Web SDK configs are read from per-env-suffixed env vars (e.g. `NEXT_PUBLIC_FIREBASE_API_KEY_DEV`). A single `NEXT_PUBLIC_APP_ENV` selector picks which env's values to use at build/runtime. All three sets of values can live in `.env.local` so local developers switch envs by editing one line, no file-swapping. Three Firebase projects provide full data isolation; rules, functions code, and the Next.js build artifact stay project-agnostic.

## 4. Architecture

### 4.1 What changes in the repo

```
.firebaserc                                       ← dev + beta + prod aliases (default = villa-events)
firebase.json                                     ← unchanged (project-agnostic; --project flag selects target)
firestore.rules                                   ← unchanged
firestore.indexes.json                            ← unchanged
storage.rules                                     ← unchanged
package.json (root)                               ← explicit deploy scripts per env (dev/beta/prod)
.env.example                                      ← committed template of all envs' NEXT_PUBLIC_FIREBASE_*_<ENV> keys
.env.local                                        ← gitignored; same shape as .env.example with real values
docs/ENVIRONMENTS.md                              ← reference for contributors
README.md                                         ← link to ENVIRONMENTS.md, setup section
packages/shared/src/config/environments.ts        ← env-name registry, env-var reader, fail-fast selector
packages/shared/src/config/index.ts               ← re-exports
packages/shared/test/config/environments.test.ts  ← stubs env vars; covers selector + validation
packages/shared/src/firebase/firebaseApp.ts       ← reads NEXT_PUBLIC_APP_ENV via getFirebaseConfig
packages/shared/src/index.ts                      ← re-exports config/
.github/workflows/ci.yml                          ← NEXT_PUBLIC_APP_ENV=dev + placeholder _DEV vars
```

### 4.2 What does NOT change

- `functions/src/index.ts` — `admin.initializeApp()` picks up the active project from the deploy target.
- `scripts/seed-municipalities.mjs` — already reads `GOOGLE_CLOUD_PROJECT` from env.
- App-side Firebase usage (`auth`, `db`, `storage`, `functions` exports from `@cultuvilla/shared`) — same imports, same API.

### 4.3 `.firebaserc` after change

```json
{
  "projects": {
    "default": "villa-events",
    "dev": "villa-events",
    "beta": "cultuvilla-beta",
    "prod": "cultuvilla-prod"
  }
}
```

`default` stays as `villa-events` so any bare `firebase ...` command (without `--project`) hits dev — same behaviour as today. Explicit beta/prod requires `--project beta`/`--project prod`.

### 4.4 Root `package.json` additions

Deploy scripts are explicit per env. There is no `deploy:beta` / `deploy:prod` shorthand — accidentally typing `dev` will not deploy elsewhere.

```
"deploy:rules:{dev,beta,prod}":      "firebase deploy --only firestore:rules,storage --project <env>",
"deploy:indexes:{dev,beta,prod}":    "firebase deploy --only firestore:indexes --project <env>",
"deploy:functions:{dev,beta,prod}":  "pnpm functions:build && firebase deploy --only functions --project <env>",
"deploy:firestore:{dev,beta,prod}":  "firebase deploy --only firestore --project <env>",
"deploy:all:{dev,beta,prod}":        "pnpm functions:build && firebase deploy --project <env>",
```

(Each `{dev,beta,prod}` expands to three real script entries.) `pnpm help` lists each one with a one-line description.

### 4.5 `packages/shared/src/config/environments.ts`

A small module that:
1. Defines the `AppEnv` type (`'dev' | 'beta' | 'prod'`) and a runtime list (`APP_ENVS`).
2. `resolveAppEnv(raw)` — validates the `NEXT_PUBLIC_APP_ENV` value, throws on unknown/missing.
3. `getFirebaseConfig(rawEnv)` — reads the per-env env vars (via literal `process.env.NEXT_PUBLIC_FIREBASE_*_<ENV>` accesses, so Next.js can inline them at build time), then asserts every required field is non-empty.

Sketch:

```ts
export type AppEnv = 'dev' | 'beta' | 'prod';
export const APP_ENVS = ['dev', 'beta', 'prod'] as const;

export function resolveAppEnv(raw: string | undefined): AppEnv {
  if (raw === 'dev' || raw === 'beta' || raw === 'prod') return raw;
  throw new Error(`NEXT_PUBLIC_APP_ENV must be one of dev, beta, prod (got ${JSON.stringify(raw)})`);
}

function readConfig(env: AppEnv): FirebaseWebConfig {
  switch (env) {
    case 'dev':  return { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY_DEV ?? '', ... };
    case 'beta': return { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY_BETA ?? '', ... };
    case 'prod': return { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY_PROD ?? '', ... };
  }
}

export function getFirebaseConfig(rawEnv: string | undefined): FirebaseWebConfig {
  const env = resolveAppEnv(rawEnv);
  const cfg = readConfig(env);
  // assertComplete() throws naming the missing keys
  return cfg;
}
```

`firebaseApp.ts` is a thin consumer:

```ts
import { getFirebaseConfig } from '../config/environments';
const firebaseConfig = getFirebaseConfig(process.env.NEXT_PUBLIC_APP_ENV);
```

### 4.6 `.env.example` (committed)

Single file with all three envs' keys, blank values, grouped by env:

```
NEXT_PUBLIC_APP_ENV=dev

# DEV (villa-events)
NEXT_PUBLIC_FIREBASE_API_KEY_DEV=
… (6 keys)

# BETA (cultuvilla-beta)
NEXT_PUBLIC_FIREBASE_API_KEY_BETA=
…

# PROD (cultuvilla-prod)
NEXT_PUBLIC_FIREBASE_API_KEY_PROD=
…
```

`.env.local` is a copy of this with real values filled in. Gitignored.

### 4.7 Vercel env-var layout

Per Vercel scope, set `NEXT_PUBLIC_APP_ENV` plus the env-specific Firebase keys:

| Scope                    | `NEXT_PUBLIC_APP_ENV` | Firebase keys                |
| ------------------------ | --------------------- | ---------------------------- |
| Development + Preview    | `dev`                 | `NEXT_PUBLIC_FIREBASE_*_DEV` |
| Production               | `prod`                | `NEXT_PUBLIC_FIREBASE_*_PROD`|

A scope only needs the keys for its own env. Setting all three sets on every scope is also fine (the build only reads the active env's keys); useful if you anticipate switching scopes frequently.

If beta later gets its own Vercel project (or scope), set `NEXT_PUBLIC_APP_ENV=beta` + `NEXT_PUBLIC_FIREBASE_*_BETA` there.

## 5. Migration steps (high level)

1. **Create `cultuvilla-prod` Firebase project.** Same region as dev (`europe-southwest1`). Enable Firestore, Storage, Auth providers (Email/Password + Google), upgrade to Blaze, add a Web app. **(Done.)**
2. **Create `cultuvilla-beta` Firebase project.** Same setup as prod. **(Pending — user task.)**
3. **Update `.firebaserc`** with `dev`, `beta`, `prod` aliases. **(Done.)**
4. **Add per-env deploy scripts** (`deploy:*:{dev,beta,prod}`) to root `package.json`. **(Done.)**
5. **Add config selector.** `packages/shared/src/config/environments.ts` validates `NEXT_PUBLIC_APP_ENV`, reads per-env-suffixed `NEXT_PUBLIC_FIREBASE_*_<ENV>` vars, fails fast on missing keys. Vitest covers selector + validation. **(Done.)**
6. **Switch `firebaseApp.ts`** to `getFirebaseConfig(process.env.NEXT_PUBLIC_APP_ENV)`. **(Done.)**
7. **Expand `.env.example`** with template entries for all three envs. **(Done.)**
8. **Update CI workflow** with `NEXT_PUBLIC_APP_ENV=dev` + placeholder `NEXT_PUBLIC_FIREBASE_*_DEV` values for build. **(Done.)**
9. **Write `docs/ENVIRONMENTS.md`** and link from `README.md`. **(Done.)**
10. **Update local `.env.local`** with real dev + prod values (beta blank until project exists). **(Pending — needs running locally, not in worktree.)**
11. **Configure Vercel env vars:** delete the existing six `NEXT_PUBLIC_FIREBASE_*` entries; add `NEXT_PUBLIC_APP_ENV` + `NEXT_PUBLIC_FIREBASE_*_DEV` (Preview+Development) and `NEXT_PUBLIC_APP_ENV` + `NEXT_PUBLIC_FIREBASE_*_PROD` (Production). **(Pending — user task.)**
12. **Deploy backend** to each non-dev env:
    - `pnpm deploy:rules:prod && pnpm deploy:indexes:prod && pnpm deploy:functions:prod`
    - (Same `:beta` commands once the beta Firebase project exists.) **(Pending — after merge.)**
13. **Smoke test:**
    - Local dev (`pnpm web:dev` with `NEXT_PUBLIC_APP_ENV=dev`) hits `villa-events`.
    - Vercel Preview hits `villa-events`.
    - Vercel Production hits `cultuvilla-prod`.
    - Confirm with a one-time `console.log` of `getFirebaseConfig(process.env.NEXT_PUBLIC_APP_ENV).projectId`.

## 6. Risks and mitigations

| Risk                                                       | Mitigation                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Accidentally deploying functions/rules to beta or prod from a dev machine. | All deploy scripts require an explicit `:beta` or `:prod` suffix. No bare `firebase deploy` shortcut. |
| Seed script run against beta/prod by mistake.              | Seed script reads `GOOGLE_CLOUD_PROJECT` from env and fails closed if not set. No `:beta` / `:prod` shortcuts. |
| Misconfigured Vercel scope → wrong env at runtime.         | `getFirebaseConfig` is fail-fast: unknown `NEXT_PUBLIC_APP_ENV` or missing `NEXT_PUBLIC_FIREBASE_*_<ENV>` values throw with a clear error listing what's missing. Production build with the wrong selector value won't start, surfacing the problem immediately. |
| Firebase Auth providers differ between envs and break sign-in. | Mirror provider config across all three projects at creation time. Documented in `docs/ENVIRONMENTS.md`. |
| Functions deployed to prod reference dev-only resources.   | Functions code is project-agnostic (`admin.initializeApp()` picks up the runtime project). |
| Contributor onboarding: where do values come from?         | `.env.example` is committed with all keys + comments. `vercel env pull` is documented as a shortcut. Errors at startup name the missing vars. |

## 7. Rollback

If a non-dev project turns out to be misconfigured (region mismatch, auth misconfig, etc.):

1. Revert the Vercel scope's `NEXT_PUBLIC_APP_ENV` back to `dev`. That scope's deployments redeploy against the dev project.
2. Leave the misconfigured project in place but unused — no data loss since it starts empty.
3. Optionally recreate the project (different ID) and update `.firebaserc` + Vercel vars accordingly.

No data migration to undo. Rollback window is "until the first real user signs up against the bad project."

## 8. Acceptance criteria

- [x] `.firebaserc` lists `dev`, `beta`, `prod` aliases pointing to distinct project IDs.
- [x] `firebase use dev|beta|prod` resolves to the right project (dev + prod verified; beta verified after creation).
- [x] `packages/shared/src/config/environments.ts` exports `APP_ENVS`, `resolveAppEnv`, `getFirebaseConfig`. Tests cover happy paths, unknown env name, and missing env vars.
- [x] `firebaseApp.ts` initialises via `getFirebaseConfig(process.env.NEXT_PUBLIC_APP_ENV)`.
- [x] `.env.example` template lists all three envs' keys.
- [x] CI workflow sets `NEXT_PUBLIC_APP_ENV=dev` + placeholder `_DEV` values.
- [x] `docs/ENVIRONMENTS.md` documents the matrix, env-var pattern, and deploy commands; linked from `README.md`.
- [x] `pnpm check` passes (lint + typecheck + test + build) with the new env wiring.
- [ ] `pnpm deploy:rules:prod` deploys to `cultuvilla-prod` (verified in Firebase console).
- [ ] `pnpm deploy:functions:prod` deploys to `cultuvilla-prod`.
- [ ] Vercel Preview deployment loads with `getFirebaseConfig(...).projectId === 'villa-events'`.
- [ ] Vercel Production deployment loads with `getFirebaseConfig(...).projectId === 'cultuvilla-prod'`.
- [ ] `cultuvilla-beta` Firebase project exists with rules/indexes/functions deployed.

## 9. Follow-ups (out of scope for this spec)

- **App Check.** Enable on `cultuvilla-prod` (and `cultuvilla-beta`) to limit who can call Firebase services. reCAPTCHA Enterprise provider for web. ~15 min.
- **Apex domain on Vercel.** Track separately. When configured, add it to Firebase Auth → Authorized domains in `cultuvilla-prod`.
- **Beta web URL.** When beta needs its own deployed web URL: add a second Vercel project (or use a branch + scope) with `NEXT_PUBLIC_APP_ENV=beta` and the `_BETA` vars set.
- **CI-driven deploys.** When added, prod deploys should require a protected GitHub Environment with manual approval; dev deploys can run automatically on `main`.
- **Mobile app.** When `apps/mobile` arrives, it imports `resolveAppEnv` / `getFirebaseConfig` from `@cultuvilla/shared` and reads `EXPO_PUBLIC_*_<ENV>` (or platform-equivalent) vars driven by `EAS_BUILD_PROFILE`.

---

## Appendix A — Reference: how ordago-apps does it (for context)

Ordago's three environments (`development`, `beta`, `production`) are wired via a single `EAS_BUILD_PROFILE` env var read in [`apps/ordago-app/app.config.js`](/home/powervaro/githubs/ordago-apps/apps/ordago-app/app.config.js). That config object injects per-env Firebase, Google OAuth, Google Maps, and Sentry settings at Expo build time. Distinct native files (`google-services.{env}.json`, `GoogleService-Info.{env}.plist`) ship in the repo, and a dev-client bundle ID (`com.ordago.app.devclient`) lets the dev build install alongside prod on the same device.

The patterns cultuvilla **adopts** from this:

1. **Three Firebase projects** (dev / beta / prod), aliased in `.firebaserc`.
2. **Single env-var selector** for the active env (`NEXT_PUBLIC_APP_ENV` ↔ `EAS_BUILD_PROFILE`).
3. **Explicit per-env deploy commands** — never a bare `firebase deploy`.

The patterns cultuvilla **omits** as mobile-specific:

- Native config files (`google-services.{env}.json`, `GoogleService-Info.{env}.plist`).
- Distinct dev-client bundle IDs.
- Mobile store distribution lanes (TestFlight / Play Internal Track for beta).

When mobile arrives, those return naturally on the Expo side, sharing the `resolveAppEnv` / `getFirebaseConfig` selector from `@cultuvilla/shared`.
