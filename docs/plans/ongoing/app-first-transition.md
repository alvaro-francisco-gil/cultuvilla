# App-first transition — web as the anonymous read surface

**Goal:** move Cultuvilla toward the app as the primary product *without taking
anything away from the web*: the web becomes an excellent anonymous read surface
(share links + Google), and the app earns the install by being better — push
notifications first.

The principle is settled and lives in
[web-parity-not-a-build-rule.md](../../decisions/web-parity-not-a-build-rule.md)
(AGENTS.md invariant 6). This plan tracks the work that follows from it until it
is verified in production.

## Status

- **Updated:** 2026-09-11
- **Stage:** Phase 1 (SEO) — code merged, **three defects found before verification**; dev deploy in flight.
- **Branch:** n/a — #329 merged; the Phase 1 fixes below need a new branch.
- **Done:**
  - Phase 0: parity rule dropped, decision recorded — `89c4d6f1` (direct to `develop`).
  - Phase 1 code: server-rendered share-link content, JSON-LD, canonical, `noindex` for private events and `/join`, live `/sitemap.xml` + `/robots.txt` — PR #329, merge `85e34d62`. CI green (lint/typecheck/unit/build, emulator suites).
- **Next:**
  1. **Fix: `robots.txt` must disallow everything except on the prod domain.** It currently serves `Allow: /` + a sitemap on dev and beta too, which invites Google to index `villa-events.web.app` / `cultuvilla-beta.web.app` — demo seed data under the Cultuvilla name. Serve `Disallow: /` (no sitemap line) unless the host is `cultuvilla.es`. **Must land before the next `develop → beta` promotion.**
  2. **Fix: `+html.tsx` is ignored in production.** See Handoff for the evidence. It means three things never shipped: the `lang="es"` fix (`d2113add`, 2026-07-11), the iOS `apple-itunes-app` tag (`efaac978`, 2026-09-04), and #329's default title/description/og. The iOS one matters most — `SmartAppBanner` hides our own banner on iOS Safari *because* Apple's bar is supposed to draw from that tag, so iOS Safari visitors may currently get **no install offer at all** (confirm on a device). Candidate fix: move the head into `apps/mobile/public/index.html`, which Expo uses as the template in single-page mode, then delete `+html.tsx`. Lock it in by extending `scripts/check-web-export.mjs` to assert that the exported `index.html` contains `lang="es"` and `apple-itunes-app`. The `[Unreleased]` CHANGELOG entry from #329 already claims those defaults exist, so this has to land before that entry is stamped into a release.
  3. **Fix: canonical must use the canonical host, not the requesting origin.** Prod is reachable at both `cultuvilla.es` and `cultuvilla-prod.web.app`; `ogRenderer` and the sitemap build URLs from `x-forwarded-host`, so each host declares itself canonical and the two compete. Pin to `cultuvilla.es` on prod (the `deepLinkHost` config already names it).
  4. Then the verification rows in the table below, env by env.
- **Blockers:**
  - Dev deploy run `34535736654` (for `bb9ecaa0`, which includes #329) was still `in_progress` at 2026-09-11. The run for #329's own merge (`85e34d62`) was cancelled by #327 merging four seconds later — expected `cancel-in-progress`, not a failure.
  - **Search Console needs Alvaro** — property verification for `cultuvilla.es` and the sitemap submission are console actions under the domain owner's account.
  - Phase 3 is gated on **Android reaching Play production** — tracked in [store-release.md](store-release.md), not here.
- **Handoff:**
  - **How we know `+html.tsx` is ignored:** `web.output` is `'single'` in `app.config.ts`, and Expo Router only uses `+html.tsx` for `static`/`server` output. Proven twice on 2026-09-11: `curl -s https://cultuvilla.es/` returns `<html lang="en">`, `<title>Cultuvilla</title>`, and no `apple-itunes-app`; and a local `npx expo export --platform web --output-dir <scratch>` (run from `apps/mobile`) produces the same `lang="en"` / `<title>Cultuvilla Dev</title>` with none of the file's tags. Re-run that export + `grep -oE '<html[^>]*>|<title>[^<]*</title>|apple-itunes-app' <out>/index.html` to verify any fix — it takes about a minute and needs no emulators.
  - **`ogRenderer` fetches the live `/index.html` as its shell** (`functions/src/og/spaShell.ts`, cached 1h per instance). A template change therefore reaches every share-link route too. `injectMeta` strips and replaces title/description/og/canonical/robots/JSON-LD, so the defaults and the per-page tags cannot both apply.
  - **The sitemap uses no composite index, on purpose** — every query is a single-field order plus a limit, filtered in memory. Keep it that way: an index would put `firestore.indexes.json` (a hard-stop path) in every change to the sitemap.
  - **Web E2E (Playwright) only runs on PRs to `beta`/`main`**, so it was skipped on #329. Its first real run against the server-rendered first paint is the next promotion — read it closely.

## Rollout status

| Step | Dev (`villa-events`) | Beta (`cultuvilla-beta`) | Prod (`cultuvilla-prod`) |
|---|---|---|---|
| **Phase 0** — parity rule + decision | ✅ | ✅ (docs) | ✅ (docs) |
| **Phase 1** — SEO code deployed | ⏳ run `34535736654` | ⬜ | ⬜ |
| Fix: `robots.txt` blocks non-prod hosts | ⬜ | ⬜ | ⬜ |
| Fix: head template actually ships (`lang`, iOS tag, defaults) | ⬜ | ⬜ | ⬜ |
| Fix: canonical pinned to `cultuvilla.es` | n/a | n/a | ⬜ |
| `curl` checks pass (see below) | ⬜ | ⬜ | ⬜ |
| Mobile web: content → content, no spinner flash | ⬜ | ⬜ | ⬜ |
| WhatsApp preview unchanged | ⬜ | ⬜ | ⬜ |
| Playwright web E2E green on promotion | — | ⬜ | ⬜ |
| Search Console: sitemap submitted | — | — | ⬜ |
| Rich Results Test passes for one event URL | — | — | ⬜ |
| Indexed: villages/events present; no `/person`, `/join`, staging hosts | — | — | ⬜ |
| **Phase 2** — push notifications in store binaries | ⬜ | ⬜ | ⬜ |
| **Phase 3** — platform-split data + one revisit check | — | — | ⬜ |

Legend: ⬜ pending · ⏳ in progress · ✅ done · ⚠️ blocked (note inline)

## Phase 1 — make the web good at its one job (SEO)

Code is in #329. What remains is the three fixes above and verification.

**`curl` checks, per env** (substitute the host; on prod use `cultuvilla.es`):

- [ ] `curl -sI <host>/sitemap.xml` → `200`, `application/xml`; the body lists `/village/…` and `/event/…` URLs **on the canonical host**. On dev/beta, after fix 1: no sitemap reference in robots.
- [ ] `curl -s <host>/robots.txt` → on prod: `Disallow: /person/`, `Disallow: /*/join$`, a `Sitemap:` line. On dev/beta: `Disallow: /`.
- [ ] `curl -s <host>/event/<publicId>` → `id="seo-content"` appears **before** `id="root"`; `"@type":"Event"`; one `rel="canonical"` with no query string.
- [ ] `curl -s <host>/village/<id>/join` → `<meta name="robots" content="noindex,follow"/>`.
- [ ] `curl -s <host>/` → `lang="es"`, a real `<title>`, and (prod) `apple-itunes-app`.

**Manual:**

- [ ] Open a shared event link on a phone browser, cold: content paints, then the app takes over **without** a spinner in between. If a spinner shows, `dismissSeoShell` is firing too early — check `EntityDetailScaffold` / `VillageHomeBody`.
- [ ] Paste an event link into WhatsApp: the preview card is unchanged from before #329.
- [ ] iOS Safari on `cultuvilla.es`: Apple's App Store bar shows (after fix 2).

**Prod only (Alvaro):**

- [ ] Verify the `cultuvilla.es` property in Google Search Console if not already done; submit `https://cultuvilla.es/sitemap.xml`.
- [ ] Run one public event URL through the Rich Results Test.
- [ ] ~2–4 weeks later, check Search Console coverage: village and event pages indexed; no `/person/…`, `/…/join`, and no `*.web.app` hosts.

## Phase 2 — push notifications (the reason to install)

The app is currently the same code as the web with a home-screen icon: there is no
`expo-notifications` and no FCM anywhere. The Buzón
([unified-inbox.md](../../decisions/unified-inbox.md)) already has the data —
`users/{uid}/notifications` — and no transport, so a villager learns their
solicitud was approved only if they happen to open the app. Push is what makes the
app strictly better than the web without making the web worse.

Needs its own design before any code (run `ship-a-feature` when starting). Known
constraints to design around:

- [ ] Design: which notification types push (all of them, or a curated subset);
      when to ask for OS permission (on first meaningful moment, not at launch);
      device-token storage per user and device, and cleanup on sign-out / account
      deletion (`account-lifecycle.md`); the trigger that turns a notification
      doc into a push.
- [ ] **This is native code, so it cannot ship over OTA.** `expo-notifications`
      is a config-plugin native module: it changes the `fingerprint`
      runtimeVersion, so EAS will correctly refuse to serve it to installed
      binaries. It needs a `mobile-release` store build and the
      `expo-native-rebuild` skill. Plan the release around that.
- [ ] Credentials: APNs key for iOS, FCM for Android, in each of dev/beta/prod.
- [ ] App-only by design — invariant 6 explicitly allows this. The web keeps the
      in-app Buzón; no web-push.
- [ ] Shipped in store binaries on both platforms (Android reach depends on Play
      production).

## Phase 3 — measure, then revisit once

The decision deliberately defers "should anything leave the web?" until there is
data, and names the trigger. This phase runs that check exactly once.

- [ ] Android in Play production and a public launch (tracked in [store-release.md](store-release.md)).
- [ ] A platform split in analytics: sessions **and write actions** (signups,
      posts, comments) by `web` / `ios` / `android`. Builds on
      [product-analytics-behavioral-dashboard.md](product-analytics-behavioral-dashboard.md).
- [ ] After roughly one release of data, run the decision's revisit check: is there
      any web flow with a **measurable** maintenance cost **and** negligible web
      usage? Record the answer in the decision doc's *Revisit when* section,
      including a "no" — that is a result.

## Retire when

All of: Phase 1 verified on **prod** and Google is indexing real pages; push
notifications live in production binaries on both stores; the Phase 3 revisit
check done once and recorded. Then delete this plan. The durable rationale is
already in the decision doc — only add to it what reality taught.

## Not tracked here

These are related but have their own plans: [store-release.md](store-release.md)
(Android to Play production), [app-check-rollout.md](../ready/app-check-rollout.md),
and [native-firebase-sdk-migration.md](../ideas/native-firebase-sdk-migration.md).
Both of the last two get cheaper once parity is no longer a rule, but neither is
required to finish this transition.
