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
- **Stage:** Phase 1 (SEO) — **shipped and verified on dev**. Next move is the promotion to beta, then prod.
- **Branch:** n/a — #329, #336 and #338 all merged to `develop`.
- **Done:**
  - Phase 0: parity rule dropped, decision recorded — `89c4d6f1`.
  - Phase 1 code (#329, `85e34d62`): server-rendered share-link content, JSON-LD, canonical, `noindex` for private events and `/join`, live `/sitemap.xml`.
  - Phase 1 fixes (#336, `f3de0061`): static per-env `robots.txt` (only prod indexable); the document head moved to `apps/mobile/public/index.html` with `+html.tsx` deleted; one canonical host per project (`webOriginForProject`, which also fixed prod emails linking to `cultuvilla-prod.web.app`); the content block turned into an overlay; a root-layout failsafe to release it. `check-web-export` now gates the document and the env's robots.
  - Phase 1 regression fix (#338, `8a115ad1`): `ogRenderer` drops HTML comments before rewriting the head.
  - **Verified on dev 2026-09-11** — every `curl` check below passes on `villa-events.web.app`.
- **Next:**
  1. **Promote `develop → beta`.** Nothing else is pending on dev. Read the **Playwright web E2E** run closely: it only runs on PRs to `beta`/`main`, so this is its first pass over the server-rendered first paint.
  2. Re-run the `curl` checks against `cultuvilla-beta.web.app` (expect `Disallow: /`).
  3. Promote `beta → main`, re-run the checks on `cultuvilla.es`, then the prod-only items (Search Console, Rich Results).
  4. The manual mobile-web and WhatsApp checks — neither has been done on any env yet; both need a phone.
- **Blockers:**
  - **Search Console needs Alvaro** — property verification for `cultuvilla.es` and the sitemap submission are console actions under the domain owner's account.
  - Phase 3 is gated on **Android reaching Play production** (submitted 2026-09-08, in review) — tracked in [store-release.md](store-release.md), not here.
- **Handoff:**
  - **`+html.tsx` does nothing in this app.** `web.output` is `'single'`, and Expo only uses that file for `static`/`server` output; the head lives in `apps/mobile/public/index.html`. That file swallowed the July `lang="es"` fix and the 4 Sep iOS App Store tag without a single failing check. `check-web-export` now asserts both in the built output, and `webDocument.test.ts` pins the template.
  - **Expo fills the title placeholder with `String.replace` — first occurrence only.** Never name it above `<title>`, comments included, or the literal placeholder becomes the page title. Pinned by a test.
  - **A Cloud Function can never serve `/robots.txt` or `/favicon.ico`.** The Functions Framework answers both itself with an empty 404 before any handler runs, so a Hosting rewrite to a function silently 404s while the function answers fine on its own URL (path `/`). That is why robots is a static per-env file.
  - **Test the renderer against the real template, not a fixture.** `stripExistingMeta`'s regexes cannot tell markup from prose: a comment merely *mentioning* `<title>` gave the title regex a start point and deleted `<html lang>`, charset and the viewport meta on every share page. Every hand-written-shell test passed. `functions/src/__tests__/og/template.test.ts` now renders `apps/mobile/public/index.html` itself — keep new renderer assertions there.
  - **The sitemap uses no composite index, on purpose** — single-field order plus a limit, filtered in memory. Keep it that way: an index would put `firestore.indexes.json` (a hard-stop path) into every sitemap change.
  - **Verifying a deploy:** `curl` the checks below with a cache-busting query (`?cb=$RANDOM`) — Hosting caches a 404 for 10 minutes, which reads exactly like a broken rewrite.

## Rollout status

| Step | Dev (`villa-events`) | Beta (`cultuvilla-beta`) | Prod (`cultuvilla-prod`) |
|---|---|---|---|
| **Phase 0** — parity rule + decision | ✅ | ✅ (docs) | ✅ (docs) |
| **Phase 1** — SEO code deployed | ✅ | ⬜ | ⬜ |
| Fix: `robots.txt` blocks non-prod hosts | ✅ | ⬜ | ⬜ |
| Fix: head template actually ships (`lang`, iOS tag, defaults) | ✅ | ⬜ | ⬜ |
| Fix: share pages keep their head (comment strip) | ✅ | ⬜ | ⬜ |
| Fix: canonical is the project's own origin | ✅ | ⬜ | ⬜ (must read `cultuvilla.es`) |
| `curl` checks pass (see below) | ✅ | ⬜ | ⬜ |
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

Code is in #329, #336 and #338, and passes on dev. What remains is promoting it
and repeating these checks per env.

**`curl` checks, per env** (substitute the host; on prod use `cultuvilla.es`):

- [ ] `curl -sI <host>/sitemap.xml` → `200`, `application/xml`; the body lists `/village/…` and `/event/…` URLs **on the canonical host**. On dev/beta, after fix 1: no sitemap reference in robots.
- [ ] `curl -s <host>/robots.txt` → on prod: `Disallow: /person/`, `Disallow: /*/join$`, a `Sitemap:` line. On dev/beta: `Disallow: /`.
- [ ] `curl -s <host>/event/<publicId>` → `id="seo-content"` appears **before** `id="root"`; `"@type":"Event"`; one `rel="canonical"` with no query string; and the document survived the head rewrite — `<html lang="es">`, `<head>`, `<meta charset>`, the viewport meta, exactly one `<title>` and one `description`, and **no unbalanced `<!--`**.
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
