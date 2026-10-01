# App-only transition — the app is the product, web is a read site

**Priority:** high — unblocks offline-first, the main app-speed fix
**Gate:** none
**Next:** wire `@react-native-firebase/analytics` behind `apps/mobile/lib/observability/analytics.ts` so native events reach GA4 with a `platform` dimension
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

- [ ] `@react-native-firebase/app` + `analytics` with their config plugins;
      `analytics.ts` forwards the same taxonomy as web (see the
      `observability-conventions` skill — the allowlist and consent split apply
      unchanged).
- [ ] An `app.opened.from_link` (or equivalent through the review gate) event
      on universal-link launch, carrying the entity kind — this is the
      install-from-link signal.
- [ ] GA4 reports `user_pseudo_id` as null on web today (every row counts as 0
      users) — check whether that is consent mode or config, so the platform
      split counts people, not only events.
- [ ] Native module → fingerprint changes → `mobile-release` store build, not
      OTA (`expo-native-rebuild` skill). Bundle it with the next native release.

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
