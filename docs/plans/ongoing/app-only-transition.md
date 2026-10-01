# App-only transition — the app is the product, web is a read site

**Priority:** high — unblocks offline-first, the main app-speed fix
**Gate:** none
**Next:** register an iOS app per env in Firebase and commit each `GoogleService-Info.plist` (see `apps/mobile/google-services/README.md`), then start phase 2
**Due:** 2027-04-30

The decision and the data behind it are in
[web-is-a-read-site.md](../../decisions/web-is-a-read-site.md). This plan tracks
the work until the Expo web export is gone and the read site serves every
public route in prod. `Due` is the deadline for the web sign-up decision
(phase 5), which must land before the 2027 fiesta season.

Replaces *app-first-transition* (which assumed web stays a full app) and the
*native-firebase-sdk-migration* idea (now [offline-first-village.md](../ready/offline-first-village.md)).

## Phases

| Phase | What | Ships via |
|---|---|---|
| 1 | Native analytics | store build |
| 2 | Read site (`apps/web`) | hosting + Cloud Run |
| 3 | Route-by-route cutover | `firebase.json` rewrites |
| 4 | Delete the Expo web export | code removal |
| 5 | Web sign-up decision | decision record |

Offline-first starts after phase 4 — tracked in its own plan.

## Phase 1 — native analytics (measure install-from-link)

Today `apps/mobile/lib/observability/analytics.ts` is a no-op on native; only
`analytics.web.ts` reports. Without native events the phase 5 question cannot be
answered.

- [x] `@react-native-firebase/app` + `analytics`; `analytics.ts` forwards the
      same taxonomy as web, dots mapped to underscores (GA4 native rejects
      dotted names — join platforms with `REPLACE(event_name, '.', '_')`).
- [x] `app.link.opened` on every routed deep link, with `entityKind`,
      `viaInvite` and `surface` (`cold_start` / `running`).
- [ ] **iOS:** register an iOS app in each Firebase project and commit
      `google-services/<env>/GoogleService-Info.plist`. Until then iOS builds
      fine but analytics is a no-op there; Android reports from its existing
      `google-services.json`.
- [ ] Ship in the next `mobile-release` (native: no OTA). Confirm events in
      GA4 DebugView on one Android and one iOS build.
- [ ] GA4 reports `user_pseudo_id` as null on web today (every row counts as 0
      users) — check whether that is consent mode or config, so the platform
      split counts people, not only events.
- **Not measurable directly:** a user who installs from the store after
      tapping a link arrives without the link (no deferred deep linking). The
      proxy is web share-link visits vs. native `first_open` over the same
      window, plus `app.link.opened` for people who already have the app.

## Phase 2 — the read site

**Shape:** Next.js under `apps/web/`, modelled on ordago's `ordago-web`
(Next.js on Cloud Run, Admin SDK reads on the server). Firebase Hosting stays in
front — it keeps `cultuvilla.es`, the static `robots.txt`, `.well-known/` and
`/descarga`, and rewrites page routes to the Cloud Run service. One service per
env (dev / beta / prod), deployed by the existing promotion pipeline.

Pages (public data only, Spanish village-first URLs from `urls.ts`):

- [ ] Village home `/<pueblo>` and its lists: carteles, lugares, entidades,
      historia, vocabulario, barrios
- [ ] Details: evento, noticia, entidad, lugar, barrio, cartel, acontecimiento,
      palabra
- [ ] `/<pueblo>/entidad/<id>/unirse` → landing that opens the app or the store
- [ ] `/descarga`, `/legal/*`, `/borrar-cuenta` (Play's account-deletion URL)
- [ ] `/sitemap.xml`, per-env `robots.txt`, canonical host, `noindex` for
      private events and invite paths
- [ ] OG tags + JSON-LD — port `functions/src/og/` (fetchers, `jsonLd.ts`,
      `seoBody.ts`) rather than rewrite; it already reads best-effort, without
      strict converters, on purpose
- [ ] Every action button → app CTA (universal link, store fallback), plus
      the `apple-itunes-app` meta so iOS Safari draws its install banner

Tests: page-level rendering against seeded emulator data; the OG/JSON-LD
assertions from `functions/src/__tests__/og/` move with the code.

## Phase 3 — cutover

Switch `firebase.json` rewrites one route family at a time from
`ogRenderer` / `index.html` to the read site, on dev → beta → prod. A route
moves only once its share preview and JSON-LD are verified with `curl` on that
env. Then delete `ogRenderer` and `sitemap` functions.

Carry-over gotchas from the previous web setup that still apply:

- A Cloud Function (or Cloud Run behind Hosting) cannot serve `/robots.txt` or
  `/favicon.ico` reliably — keep both static per env.
- The sitemap uses no composite index on purpose (an index puts
  `firestore.indexes.json`, a hard-stop path, into every sitemap change).
- Verify with a cache-busting query (`?cb=$RANDOM`): Hosting caches a 404 for
  10 minutes, which reads exactly like a broken rewrite.
- The prod AASA deliberately lags the app routes — see
  [spanish-village-urls.md](../../decisions/spanish-village-urls.md) before
  widening it.

Prod-only, once the read site serves prod: Search Console property + sitemap
submission for `cultuvilla.es`, one Rich Results Test, coverage check 2–4
weeks later.

## Phase 4 — delete the Expo web export

- [ ] `.web.*` overrides, `Platform.OS === 'web'` branches, `seoShell`,
      `useWebPullToRefresh`, `apps/mobile/public/index.html`
- [ ] `app:web:build`, `check-web-compat`, `check-web-export`, the Playwright
      web E2E (`test:e2e:web`) and its CI lane — replaced by the read site's tests
- [ ] The `mobile-web-compat` skill and the web memories it encodes
- [ ] AGENTS.md: drop the web sections that describe the export

## Phase 5 — web sign-up decision

With one autumn of native data: of visitors arriving from a shared event link
on a phone, how many installed and registered? Decide whether the read site
gets a server-side sign-up flow, record it in the decision doc. **By
2027-04-30.**

## Retire when

The read site serves every public route on prod, the Expo web export is
deleted, and phase 5 is recorded. Then delete this plan.
