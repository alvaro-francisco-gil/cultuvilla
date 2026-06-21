# Web SSR on Cloud Run

## Status

- **Updated:** 2026-06-22
- **Stage:** Stage 2 — switch `web.output: 'server'` + SSR-safety
- **Branch:** cultuvilla `worktree-ssr-web-cloud-run`
- **Done:** plan doc written; Stage 1 SDK 54 → 56 (expo, expo-router, RN 0.85, React 19.2, jest-expo 56, react-test-renderer 19.2.3, @react-native/normalize-colors, scheduler); fixed StatusBar/StyleSheet API drops, splash → expo-splash-screen plugin, conditional google-signin plugin, added missing `getOrgMemberCount`, jest `^@cultuvilla/shared$` mapping, missing service mocks in village.test.tsx; all 85 mobile tests green, typecheck clean, `expo export -p web` succeeds
- **Next:** flip `web.output: 'server'` and audit SSR-safety of `bootstrapFirebase`/browser-only API usage
- **Blockers:** none
- **Handoff:** all work happens in `.claude/worktrees/ssr-web-cloud-run/`. Do NOT rebase onto main mid-flight; this branch touches `package.json`/lockfile/native config heavily and merge conflicts will be brutal. Resolve breakages before opening a PR.

## Goal

Make shared cultuvilla deeplinks (`/village/<id>`, `/event/<id>`, `/news/<id>`, `/o/<id>`) render real Open Graph metadata (title, image, description) so WhatsApp, Twitter, iMessage, Facebook, Slack, LinkedIn, and Google show rich previews — without losing the existing SPA UX for real users.

## Context

Current web is the Expo SDK 54 static export served from Firebase Hosting. The HTML is a shell with no per-route data. Crawlers see nothing useful. The deeplink service we landed last session produces working `https://<host>/<resource>/<id>` URLs, but their previews are empty.

We picked per-request SSR over (a) build-time static rendering or (b) a bot-aware Cloud Function patch, because SSR also unlocks:
- Google indexing of village / event / news pages
- Faster first-meaningful-paint on cheap Android
- Server-side auth gates without flash-of-login
- API routes that can replace some Cloud Functions

SSR in Expo Router requires SDK 55+; SDK 56 adds `generateMetadata` for first-paint metadata. We upgrade to 56.

## Design

### Architecture

```
   share link: https://<host>/village/<id>
                       │
                       ▼
   Firebase Hosting (CDN, custom domain) ──────► static assets only
                       │ all HTML routes
                       ▼ rewrite
   Cloud Run service `cultuvilla-web` (Node runtime, Expo Router server output)
                       │
                       │ on render
                       ▼
   generateMetadata({ params }) ────────────────► firebase-admin → Firestore
                       │                              │
                       │  fetch village/event/etc     │
                       ◄──────────────────────────────┘
                       │
                       ▼
   send HTML with real <title>, <meta og:*>, then hydrate React on client
```

### Per-resource metadata

| Resource | og:title | og:description | og:image |
|---|---|---|---|
| Village (`/village/[villageId]`) | `village.name` | first ~200 chars of `community.description` (or empty) | first of `community.coverImages` then `escudoFullUrl(village)` |
| Event (`/event/[eventId]`) | `event.title` | first ~200 chars of `event.description` | `event.imageURL` then `event.municipalityCoverImage` |
| News (`/news/[newsId]`) | `post.title` | first ~200 chars of `post.body` | first of `post.images` resolved through `newsImageDownloadURL` |
| Org (`/o/[orgId]`) | `org.name` | first ~200 chars of `org.description` | `org.imageURL` |

Same shape for `twitter:title`, `twitter:description`, `twitter:image`, `twitter:card=summary_large_image`.

### Server-side data fetch

`generateMetadata` runs in Node on Cloud Run. Server-side Firestore reads use `firebase-admin`. Credentials come from a service account stored in Google Secret Manager and mounted into the Cloud Run service as environment variables. No service account JSON in the repo.

Per-env service accounts: dev/beta/prod each have their own Cloud Run service binding their own Firebase project.

### Routing

Static assets (`/_expo/static/*`, `/assets/*`, `/.well-known/*`) keep coming from Firebase Hosting CDN. All other paths rewrite to the Cloud Run service. Firebase Hosting's `rewrites` array supports `run: { serviceId, region }` for this.

Custom domain stays at the Firebase Hosting host (e.g. `villa-events.web.app` today, eventually `cultuvilla.app`). DNS doesn't change; the rewrite is the only edge configuration. AASA / assetlinks files stay where they are.

### Deploy pipeline

- `apps/mobile/Dockerfile` — multi-stage build that runs `pnpm install && expo export -p web` and ends with a Node 20 image running `node ./dist/server/index.js`.
- `scripts/deploy-web.sh` — wraps `gcloud run deploy` per env. Reads `DEEP_LINK_HOST_<ENV>` from `.env` to wire `extra.deepLinkHost`. Sets Firebase admin secret bindings.
- `firebase.json` — `rewrites` gain a `run: { ... }` entry for the dynamic routes, before the existing SPA fallback.

### Cost / performance expectations

At cultuvilla's traffic Cloud Run is inside the free tier indefinitely. The one recurring cost is `--min-instances=1` (~$10/mo) to eliminate cold starts; we'll add this only on prod.

## File Structure

### Created
- `apps/mobile/app/event/[eventId]+head.tsx` — `generateMetadata` for event share
- `apps/mobile/app/news/[newsId]+head.tsx` — same for news
- `apps/mobile/app/village/[villageId]/+head.tsx` — same for village
- `apps/mobile/app/o/[orgId]+head.tsx` — same for org
- `apps/mobile/server.ts` (or similar entrypoint) — Cloud Run-friendly server bootstrap if Expo's default isn't enough
- `apps/mobile/Dockerfile`
- `apps/mobile/.dockerignore`
- `packages/shared/src/server/firestore.ts` — admin-side fetch helpers (`getVillageForOg`, `getEventForOg`, etc.) using `firebase-admin`
- `scripts/deploy-web.sh`
- `scripts/web-og/build-meta.ts` — small utility consumed by `+head.tsx` files to compose `<meta>` tags from a record

### Modified
- `apps/mobile/app.config.ts` — `web.output: 'server'`; ensure `extra.deepLinkHost` survives
- `apps/mobile/package.json` — bump expo, react, react-native, expo-router, related Expo packages to SDK 56 set; add `firebase-admin` (server-only, narrow import)
- `apps/mobile/app/_layout.tsx` — guard any browser-only init from running during SSR
- `apps/mobile/lib/firebaseInit.ts` — make `bootstrapFirebase()` SSR-safe (no-op when `typeof window === 'undefined'`)
- `firebase.json` — `hosting.rewrites` adds `run: { serviceId: cultuvilla-web-<env>, region: europe-west1 }` (before the SPA catch-all)
- Any component that touches `window`/`document`/`localStorage` directly outside `useEffect` — gate behind a typeof check
- `@expo/vector-icons` → `@react-native-vector-icons/ionicons` (SDK 56 deprecates the former); replace imports across the app

### Deleted
- None planned. Existing FloatingShareButton + share pills stay.

## Tasks

### Stage 1 — SDK upgrade (must pass full typecheck/test before stage 2)
- [ ] Run `npx expo install expo@^56.0.0` + `npx expo install --fix` to align all expo packages to SDK 56
- [ ] Run `npx expo-doctor` and fix every reported issue
- [ ] Upgrade peer deps to RN 0.85 / React 19.2 (already on React 19.1 — close enough)
- [ ] Bump root `package.json` if anything is hoisted there
- [ ] Apply `expo-codemod sdk-56-expo-router-react-navigation-replace apps/mobile`
- [ ] Replace `@expo/vector-icons` imports with `@react-native-vector-icons/ionicons` (or whichever set is used) across `apps/mobile`
- [ ] `pnpm typecheck` passes
- [ ] `pnpm app:test` passes
- [ ] `pnpm app:web:build` succeeds locally
- [ ] `pnpm --filter cultuvilla-mobile start --web` boots and renders the home tab
- [ ] Commit: `chore(mobile): upgrade Expo SDK 54 → 56`

### Stage 2 — Server output + bootstrap SSR-safety
- [ ] Set `web.output: 'server'` in `app.config.ts`
- [ ] Add the `unstable_useServerRendering` flag to expo-router plugin options if SDK 56 still gates streaming behind it
- [ ] Audit `apps/mobile/lib/firebaseInit.ts` — guard `bootstrapFirebase()` so it no-ops on server
- [ ] Audit components for `window`/`document`/`localStorage` direct usage; gate behind `typeof window !== 'undefined'` or move into `useEffect`
- [ ] `pnpm app:web:build` produces a `dist/server/` folder
- [ ] `node dist/server/index.js` boots and serves `/` on localhost
- [ ] Curl localhost to confirm HTML has the SPA shell (no metadata yet)
- [ ] Commit: `feat(mobile): switch web.output to server`

### Stage 3 — Server-side Firestore + generateMetadata
- [ ] Add `firebase-admin` to `apps/mobile/package.json` (server-only import path) and a tiny `packages/shared/src/server/firestore.ts` module that re-exports admin getters for `getMunicipality`, `getEvent`, `getNewsPost`, `getOrganization`
- [ ] Wire admin credentials via `process.env.FIREBASE_SERVICE_ACCOUNT_KEY` (read at server cold start); fail loud if missing
- [ ] Write `+head.tsx` for each of the four routes with `generateMetadata({ params })`
- [ ] Each handler returns `{ title, description, openGraph: { title, description, images: [{ url, width: 1200, height: 630 }] }, twitter: { card: 'summary_large_image', ... } }`
- [ ] Curl `/event/<known-id>` and confirm HTML contains real `<meta property="og:title">` and `<meta property="og:image">`
- [ ] Commit: `feat(mobile): per-route OG metadata via generateMetadata`

### Stage 4 — Dockerize + deploy to Cloud Run dev
- [ ] Write `apps/mobile/Dockerfile` (multi-stage: builder runs `pnpm install --frozen-lockfile && pnpm --filter cultuvilla-mobile web:build`; runtime is `node:20-slim` running the server bundle)
- [ ] Write `apps/mobile/.dockerignore`
- [ ] Write `scripts/deploy-web.sh dev|beta|prod`
- [ ] Build locally with `docker build` and run `docker run -p 8080:8080 cultuvilla-web` to confirm it serves
- [ ] Create dev Cloud Run service via gcloud; bind a per-env service account from Secret Manager
- [ ] Deploy to `cultuvilla-web-dev` Cloud Run service; confirm the service URL renders an event with proper metadata
- [ ] Commit: `feat(infra): Cloud Run pipeline for dev web`

### Stage 5 — Firebase Hosting in front of Cloud Run
- [ ] Add `run` rewrite to `firebase.json` for dev hosting target: catch-all → `cultuvilla-web-dev`, but exclude `/_expo/static/**`, `/assets/**`, `/.well-known/**` (those keep being served from the CDN)
- [ ] `firebase deploy --only hosting --project dev` and confirm `villa-events-dev.web.app/event/<id>` renders with metadata
- [ ] Run the Facebook Sharing Debugger + Twitter Card Validator against a known event URL; confirm rich preview
- [ ] WhatsApp send-to-self test from a real phone
- [ ] Commit: `feat(hosting): route web traffic through Cloud Run`

### Stage 6 — Beta + prod rollout
- [ ] Repeat Stage 4–5 for beta env
- [ ] Repeat for prod with `--min-instances=1` to remove cold starts (~$10/mo)
- [ ] Update `docs/plans/ongoing/web-ssr-cloud-run.md` Status with rollout matrix
- [ ] Delete the plan file and write `docs/decisions/web-ssr-cloud-run.md` with durable rationale

## Rollout status

| Step | Dev | Beta | Prod |
|---|---|---|---|
| SDK 56 + server output | ⬜ | ⬜ | ⬜ |
| Cloud Run deployed | ⬜ | ⬜ | ⬜ |
| Hosting rewrite live | ⬜ | ⬜ | ⬜ |
| OG previews verified (FB / Twitter / WA) | ⬜ | ⬜ | ⬜ |
| `min-instances=1` set | n/a | n/a | ⬜ |

Legend: ⬜ pending · ⏳ in progress · ✅ done · ⚠️ blocked

## Out of scope

- Migrating off Firebase Hosting entirely (we keep it for static asset CDN + custom domain).
- Replacing existing Cloud Functions with Expo Router `+api.ts` routes (possible later, not this plan).
- Adding `en.json` / multi-locale SSR (Spanish-only for now).
- Branch.io / dynamic-link providers — deprecated and unnecessary.
