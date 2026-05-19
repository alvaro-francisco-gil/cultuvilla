# Environments

Cultuvilla runs in three long-lived environments. Each maps to its own
Firebase project; the active env is selected at build time by a single
`NEXT_PUBLIC_APP_ENV` variable.

| Concern             | dev                                  | beta                                 | prod                              |
| ------------------- | ------------------------------------ | ------------------------------------ | --------------------------------- |
| Firebase project    | `villa-events`                       | `cultuvilla-beta`                    | `cultuvilla-prod`                 |
| `.firebaserc` alias | `dev` (also the `default`)           | `beta`                               | `prod`                            |
| Firestore region    | `europe-southwest1` (Madrid)         | `europe-southwest1` (Madrid)         | `europe-southwest1` (Madrid)      |
| Vercel scope        | Development + Preview                | (own Vercel project, future)         | Production                        |
| Domain              | `*.vercel.app` previews, `localhost` | TBD (beta subdomain or branch)       | apex production domain (when set) |
| `NEXT_PUBLIC_APP_ENV` value | `dev`                        | `beta`                               | `prod`                            |

There is one Vercel project (`cultuvilla-web`) today. `beta` is a Firebase
project for backend testing; if/when it gets its own deployed web URL, add
a second Vercel project (or a specific branch with `NEXT_PUBLIC_APP_ENV=beta`).

## Configuration model

The active env is chosen by `NEXT_PUBLIC_APP_ENV` (`"dev" | "beta" | "prod"`).
Firebase Web SDK config values are read from per-env-suffixed env vars:

| Field               | Var name pattern                                  |
| ------------------- | ------------------------------------------------- |
| `apiKey`            | `NEXT_PUBLIC_FIREBASE_API_KEY_<ENV>`              |
| `authDomain`        | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_<ENV>`          |
| `projectId`         | `NEXT_PUBLIC_FIREBASE_PROJECT_ID_<ENV>`           |
| `storageBucket`     | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_<ENV>`       |
| `messagingSenderId` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_<ENV>`  |
| `appId`             | `NEXT_PUBLIC_FIREBASE_APP_ID_<ENV>`               |
| `measurementId`     | `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID_<ENV>` (optional) |

`<ENV>` is `DEV`, `BETA`, or `PROD`. All three sets can be present in the
same `.env.local` so you can switch which env you talk to locally by editing
one line (`NEXT_PUBLIC_APP_ENV`) — no need to swap files.

Firebase Web SDK config values are not secrets per
[Firebase docs](https://firebase.google.com/docs/projects/api-keys); they
live in env vars for cleanliness, not for security. Security is enforced
by Firestore/Storage rules and (optionally) App Check.

The selector lives in [`packages/shared/src/config/environments.ts`](../packages/shared/src/config/environments.ts).
It fails fast on missing keys with a clear error listing which vars are
missing — so misconfigured deployments surface immediately at startup.

## Local development setup

```bash
cp apps/web/.env.example apps/web/.env.local
# Fill in NEXT_PUBLIC_FIREBASE_*_DEV with villa-events Web SDK config
# (Firebase console → villa-events → Project settings → Web app)
# Leave BETA and PROD blank if you only want to work against dev locally.

pnpm install
pnpm web:dev
```

To switch to beta or prod locally, change `NEXT_PUBLIC_APP_ENV` to `beta` or
`prod` and ensure the corresponding `_BETA` / `_PROD` vars are filled in.

> **Location matters.** Next.js auto-loads env files from the project root,
> which is `apps/web/`. Put your env file at `apps/web/.env.local`, not the
> repo root. (The repo root may contain a `.env.local` written by
> `vercel env pull` — that one is not read by Next.js.) `apps/web/.env.local`
> is gitignored.

### Shortcut: pull values from Vercel

If you have Vercel CLI access to the project, `cd apps/web && vercel env pull
.env.local` writes the env vars into the right file. Saves console-clicking.
Note: re-running it will overwrite manual edits.

## Vercel env-var layout

Vercel manages env vars per scope. Each scope only needs the values for
the env it deploys:

| Scope                    | `NEXT_PUBLIC_APP_ENV` | Other vars to set                |
| ------------------------ | --------------------- | -------------------------------- |
| Development + Preview    | `dev`                 | `NEXT_PUBLIC_FIREBASE_*_DEV`     |
| Production               | `prod`                | `NEXT_PUBLIC_FIREBASE_*_PROD`    |

If a separate Vercel project (or scope) is added for beta, set
`NEXT_PUBLIC_APP_ENV=beta` and `NEXT_PUBLIC_FIREBASE_*_BETA` there.

You can also redundantly set all three sets on every scope — the build
only reads the active env's vars, but having values present everywhere
makes it easier to switch later.

## Deploying the backend

Every deploy script is explicit per environment. There is no bare
`firebase deploy` — that prevents accidental prod deploys.

```bash
# DEV (villa-events)
pnpm deploy:rules:dev          # firestore rules + storage rules
pnpm deploy:indexes:dev        # firestore indexes
pnpm deploy:firestore:dev      # rules + indexes
pnpm deploy:functions:dev      # build + deploy cloud functions
pnpm deploy:all:dev            # everything

# BETA (cultuvilla-beta)
pnpm deploy:rules:beta
pnpm deploy:indexes:beta
pnpm deploy:firestore:beta
pnpm deploy:functions:beta
pnpm deploy:all:beta

# PROD (cultuvilla-prod)
pnpm deploy:rules:prod
pnpm deploy:indexes:prod
pnpm deploy:firestore:prod
pnpm deploy:functions:prod
pnpm deploy:all:prod
```

Prerequisites:
- `firebase login` once on your machine.
- For beta/prod: be authenticated against a Google account with Editor or
  higher on the corresponding GCP project.

The Next.js app on Vercel is **not** deployed via these scripts — Vercel
deploys automatically from `main` (Production) and from every PR (Preview).

## Seeding data

The seed script always reads its target from `GOOGLE_CLOUD_PROJECT`:

```bash
# DEV
GOOGLE_CLOUD_PROJECT=villa-events pnpm seed:municipalities

# BETA
GOOGLE_CLOUD_PROJECT=cultuvilla-beta pnpm seed:municipalities

# PROD (must be explicit, never automated)
GOOGLE_CLOUD_PROJECT=cultuvilla-prod pnpm seed:municipalities
```

The script has no `:beta` / `:prod` shortcuts — seeding non-dev is a
deliberate manual act.

## Firebase Auth providers — keep parity

Auth providers must match across envs or sign-in will break in one of them.
Currently enabled on `villa-events`:

- Email/Password
- Google

When provisioning each new project (`cultuvilla-beta`, `cultuvilla-prod`),
enable the same set. For Google sign-in specifically, the OAuth client ID
will differ between projects — that's expected and managed transparently
by Firebase Auth.

## Setting up a new Firebase project (beta or prod)

1. Firebase console → Add project → name it (`cultuvilla-beta` /
   `cultuvilla-prod`).
2. **Firestore** → Create database → Production mode → region
   `europe-southwest1` (Madrid). Region is permanent.
3. **Storage** → Get started → same region.
4. **Authentication** → enable Email/Password and Google providers.
5. **Project settings → General → Your apps → Add Web app**
   (`cultuvilla-web`). Copy the 7 SDK config values.
6. **Upgrade to Blaze plan** (Project settings → Usage and billing).
   Required for Cloud Functions.
7. Fill the corresponding `NEXT_PUBLIC_FIREBASE_*_<ENV>` vars in
   `apps/web/.env.local` and/or Vercel.
8. (Recommended) **Budget alerts** in GCP Console → Billing → Budgets &
   alerts. €10–€20/month with thresholds at 50/90/100% is plenty for a
   pilot.

## Future: mobile app

When a React Native / Expo app lands under `apps/mobile`, it can read the
same `NEXT_PUBLIC_FIREBASE_*_<ENV>` vars (or Expo's `EXPO_PUBLIC_*_*`
equivalents) and use the same `resolveAppEnv` + `getFirebaseConfig`
selector — same shape, same code path, different env-var prefix.
