# Open Graph previews via Cloud Function

## Status

- **Updated:** 2026-06-22
- **Stage:** Stage 4 — dev deploy verified end-to-end; beta/prod deferred until we're past dev
- **Branch:** cultuvilla `worktree-ssr-web-cloud-run` (branch name misleading; merge to main when ready)
- **Done:** Stages 1–4. SDK 56 upgrade, og-renderer function + tests, Hosting rewrites, dev deploy. Curl against `villa-events.web.app/village/<real-id>` returns the SPA shell with `<title>` and `<meta og:*>` populated from the Firestore doc. The function is deployed to `europe-west1`; Hosting rewrites `/event/*`, `/news/*`, `/village/*`, `/o/*` (and the `/join` variants) route to it.
- **Next:** beta + prod rollout (deferred — user is still in dev phase). When beta-ready, redeploy from this branch to those projects.
- **Blockers:** none.
- **Handoff:** Two notes for whoever ships this beyond dev: (1) the global `Cache-Control: no-cache, no-store` header in `firebase.json` currently overrides the function's per-response cache directive, so every OG request hits Firestore. For dev that's fine (fresh previews while iterating); before going to prod, add an override entry under `hosting.headers` for `/event/*`, `/news/*`, `/village/*`, `/o/*` matching the function's `public, max-age=600, s-maxage=3600`. (2) During dev deploy we found that `host` header inside Cloud Run is the run.app URL, not the Hosting domain — the fix (use `x-forwarded-host` first) is in commit e2258f8.

## Goal

Render real `<title>`, `<meta og:*>`, and `<meta twitter:*>` for cultuvilla share links — `/event/<id>`, `/news/<id>`, `/village/<id>`, `/o/<id>` plus their `/join` invite variants — so WhatsApp, Twitter, Facebook, iMessage, Slack, LinkedIn, and Google show rich previews. Keep the static-CDN architecture as-is; do not introduce a continuously-running SSR server.

## Context

The deeplink service (merged earlier) produces working share URLs, but those URLs return the SPA's empty shell — crawlers see no metadata. Earlier sessions tried Expo Router SSR on Cloud Run; that failed because `expo export` in SDK 56 doesn't emit a per-request SSR module (only API routes + middleware), and `firebase-admin` doesn't survive Expo's Hermes transform of anything it does bundle.

The actual problem is small: `url → fetch one Firestore doc → return HTML with og:* injected`. That's a serverless-function shape, not a server shape. One Cloud Function intercepting the four URL families at the Hosting edge is cheaper, lower-coupling, and faster to ship than any SSR variant. The cost is essentially $0 forever at cultuvilla scale; the SPA stays on the existing CDN for all other paths.

## Design

### Topology

```
  share link: https://<host>/event/<id>
                     │
                     ▼
  Firebase Hosting (CDN, custom domain)
                     │
        ┌────────────┴─────────────────┐
        │                              │
   rewrite (paths below)          SPA fallback (** → index.html)
        │                              │
        ▼                              ▼
  Cloud Function `ogRenderer`     static SPA shell
        │                              (CDN-cached)
        ▼
  firebase-admin → Firestore
        │
        ▼
  inject og:* into <head>, return HTML
  Cache-Control: public, max-age=600, s-maxage=3600
```

Rewritten URL prefixes: `/event/*`, `/news/*`, `/village/*`, `/o/*`. Order in `firebase.json`: these four BEFORE the existing `**` catch-all.

### Per-resource og:* mapping

| URL pattern                  | og:title       | og:description                          | og:image                                                  |
|------------------------------|----------------|------------------------------------------|-----------------------------------------------------------|
| `/event/<id>`                | `event.title`  | first ~200 chars of `event.description`  | `event.imageURL` ?? `event.municipalityCoverImage`        |
| `/news/<id>`                 | `post.title`   | first ~200 chars of `post.body`          | admin signed URL of `post.images[0].storagePath` (7d)     |
| `/village/<id>`              | `municipality.name` | first ~200 chars of `community.description` | `escudoManualUrl` ?? `escudoUrl` |
| `/village/<id>/join`         | same as `/village/<id>`                                                                                 |
| `/o/<id>`                    | `org.name`     | first ~200 chars of `org.description`    | `org.imageURL`                                            |
| `/o/<id>/join`               | same as `/o/<id>`                                                                                       |

Twitter card: `summary_large_image` with the same title/description/image.

### SPA shell sourcing

The function fetches `/index.html` from its own Hosting site once per cold start, caches it in module-level state with a 1-hour TTL. The Hosting rewrite excludes `/index.html` itself so the fetch hits the CDN, not the function. If the shell fetch fails, the function returns a thin HTML body with og:* tags and a `<noscript>` fallback link — crawlers still see metadata.

This means the function never has to be redeployed when the SPA is rebuilt — it picks up the new shell within an hour.

### Cache strategy

- Function response: `Cache-Control: public, max-age=600, s-maxage=3600`. CDN holds the response 1h on edges, browsers/crawlers re-validate every 10 min.
- Doc edits reflect in crawler previews within 1h. Acceptable for share-link previews.
- Cache key is the full URL path, so `/event/abc` and `/event/abc/join` are distinct entries (intentional — the invite copy may diverge later).
- News signed URLs: 7-day expiry. Crawlers re-fetch og:image periodically and the response cache flushes weekly anyway.

### Region

Function deploys to `europe-west1` (closest to Spain). Cold-start latency is hidden by the CDN cache for hot URLs; cold misses are still < 1s.

## File Structure

### Created
- `functions/src/og/fetchers.ts` — four pure async functions over admin Firestore (`getEventOg`, `getNewsOg`, `getVillageOg`, `getOrgOg`) returning `{ title, description, imageUrl } | null`. Uses the existing admin refs in `packages/shared/src/firebase/refs/admin.ts`.
- `functions/src/og/html.ts` — `injectMeta(shell: string, meta: OgMeta): string`. Pure string transformation. Replaces or inserts `<title>`, `<meta property="og:*">`, `<meta name="twitter:*">` inside `<head>`.
- `functions/src/og/spaShell.ts` — module-level cache of the SPA's `index.html`, fetched lazily from `https://<host>/index.html`. TTL 1h. Falls back to a minimal HTML skeleton if the fetch fails.
- `functions/src/og/render.ts` — `onRequest` HTTPS handler. Parses the path, branches by resource, calls the matching fetcher, injects, responds. Uses `firebase-functions/v2/logger` per `cloud-function-logging` skill.
- `functions/src/__tests__/handlers/og/render.test.ts` — vitest emulator test: each of the 4 resources, the invite variants, 404 fallback, and news signed-URL emission.

### Modified
- `functions/src/index.ts` — export `ogRenderer`.
- `firebase.json` — add 4 rewrites for `/event/*`, `/news/*`, `/village/*`, `/o/*` → `function: ogRenderer`, BEFORE the existing `**` catch-all.
- `apps/mobile/AGENTS.md` — update the SDK 54 doc URL to SDK 56 (drift caught during the pivot).

### Deleted
- `docs/plans/ongoing/web-ssr-cloud-run.md` (replaced by this file).

## Tasks

### Stage 1 — Retire old plan, pivot baseline
- [x] `git reset --hard 7692606` to drop the SSR Stage 2/3 work
- [x] Verify mobile typecheck, tests, web build still green on `output: 'single'`
- [ ] Delete `docs/plans/ongoing/web-ssr-cloud-run.md`, write this plan
- [ ] Update `apps/mobile/AGENTS.md` to point at SDK 56 docs
- [ ] Commit: `docs: pivot SSR plan to og-renderer function`

### Stage 2 — `ogRenderer` function
- [ ] `functions/src/og/fetchers.ts` — 4 fetchers via existing admin refs; each returns `null` when the doc doesn't exist
- [ ] `functions/src/og/html.ts` — pure string-level injection; handles missing `<head>` gracefully
- [ ] `functions/src/og/spaShell.ts` — lazy fetch + 1h cache; fallback skeleton on failure
- [ ] `functions/src/og/render.ts` — `onRequest({ region: 'europe-west1', cors: false })`; routes by URL prefix; 200/404; sets Cache-Control
- [ ] Export from `functions/src/index.ts`
- [ ] Test: `functions/src/__tests__/handlers/og/render.test.ts` covering all 4 resources, both invite variants, 404, and a news post with a `storagePath` image (verifies the signed URL surfaces)
- [ ] `pnpm test:functions` green
- [ ] Commit: `feat(functions): og-renderer for share-link previews`

### Stage 3 — Hosting rewrites
- [ ] Add 4 rewrites to `firebase.json` BEFORE the SPA catch-all
- [ ] Local verify: `firebase emulators:start --only hosting,functions`, curl `/event/<seeded-id>`, confirm og:* tags
- [ ] Commit: `feat(hosting): route share-link paths to ogRenderer`

### Stage 4 — Dev deploy + crawler validation
- [ ] `firebase deploy --only functions:ogRenderer --project dev`
- [ ] `firebase deploy --only hosting --project dev`
- [ ] Curl `https://villa-events-dev.web.app/event/<known-id>` → og:* present
- [ ] Facebook Sharing Debugger: clear cache + scrape, confirm preview renders
- [ ] Twitter Card Validator: confirm `summary_large_image` renders
- [ ] WhatsApp send-to-self from a real phone — verify image + title

### Stage 5 — Beta + prod rollout
- [ ] Deploy to beta, re-validate FB + Twitter + WhatsApp
- [ ] Deploy to prod, re-validate
- [ ] Update the Rollout status table below as each step completes
- [ ] Retire plan: write `docs/decisions/og-share-link-previews.md` (decision rationale: why function over SSR), delete this plan

## Rollout status

| Step                              | Dev | Beta | Prod |
|-----------------------------------|-----|------|------|
| Function deployed                 | ✅  | ⬜   | ⬜   |
| Hosting rewrites live             | ✅  | ⬜   | ⬜   |
| Curl-verified `og:*` from real doc | ✅  | ⬜   | ⬜   |
| FB Debugger preview verified      | ⬜  | ⬜   | ⬜   |
| Twitter Card verified             | ⬜  | ⬜   | ⬜   |
| WhatsApp preview verified         | ⬜  | ⬜   | ⬜   |

Legend: ⬜ pending · ⏳ in progress · ✅ done · ⚠️ blocked

## Out of scope

- Migrating to true per-request SSR (no remaining use case justifies the runtime).
- Expo Router `+api.ts` routes (independent capability; can adopt later without SSR).
- Pre-rendering villages via `generateStaticParams` (function approach covers all resources uniformly).
- Branch.io / dynamic-link providers.
