# The app is the product — the web is a separate read site

Supersedes the September 2026 record *web-parity-not-a-build-rule*, which kept
the Expo web export as a full copy of the app and forbade taking any working
flow away from it. Its history is in git; what survives of it is folded in
below.

## Context

`apps/mobile/` ships one codebase to iOS, Android and the web (Expo web export
→ Firebase Hosting). The previous decision kept that arrangement on three
grounds. By 2026-10 two of them had expired and the third had turned into a
cost:

- **"Until Play production is live, the web *is* the Android app."** Both
  stores are public since 2026-09-28.
- **"The app has no capability the web lacks."** Push is in the store binaries
  ([device-notifications.md](../plans/ongoing/device-notifications.md)), and
  offline-first is next.
- **"There is only one codebase, so parity costs nothing."** True for screens,
  false for architecture. Because the web bundle runs the same services, every
  service must stay on the Firestore **JS** SDK — which on React Native has no
  persistent cache. That is the direct reason the app cannot open offline,
  shows skeletons on every visit, and re-reads the village on every focus. The
  web was no longer limiting a feature; it was limiting the app's data layer.

## The data at decision time (prod, 2026-07-13 → 2026-10-01)

| | Web (GA4) | All (Firestore) |
|---|---|---|
| Event registrations | 227 (5 desktop) | 253 since 2026-08-03 |
| — of which the fiesta week of 2026-08-17 | 203 | 230 |
| Onboarding completions / new users since 2026-08-03 | 102 | 125 |
| Users with a registered app device | — | 3 |

Two readings, kept separate on purpose:

- **Participation has so far happened on mobile web.** About 88% of every
  registration ever made came through the browser, almost all on a phone, in
  one fiesta week — the WhatsApp-link visitor the previous decision protected.
- **That says nothing about whether those people would have installed.** The
  app reached the stores after the fiesta, there have been no registrations
  since 2026-08-31, and native analytics was a no-op — so no install-from-link
  number exists. Desktop is ~2%, which retires the "ayuntamiento staff on a
  laptop" concern.

## Decision

1. **The app is the product.** Every capability — writes, accounts, offline,
   push — is built for iOS and Android only. Web never shapes an app API or
   the app's data layer again.
2. **The web is a separate, server-rendered read site** for the two anonymous
   audiences that matter: the WhatsApp-link recipient and Google search. It
   reads through the Admin SDK on the server and ships **no Firebase client
   SDK** to the browser. It shares only models and URL builders
   (`packages/shared/src/utils/urls.ts`) with the app — never screens or
   services — so it does not recreate the two-codebases-to-sync problem that
   sank the old Next.js `apps/web`.
3. **The Expo web export is retired** once the read site serves every public
   route. With it go the `.web.*` overrides, the `Platform.OS === 'web'`
   branches, `check-web-compat` / `check-web-export` and the
   `mobile-web-compat` skill.
4. **Every action on the read site is an app call-to-action**: open the app
   through the universal link when installed, otherwise the store via
   `/descarga`. No web sign-in, except what store policy requires (account
   deletion).
5. **Event sign-up on web is the one open question**, deliberately. The
   architecture is identical either way: if kept, it is a server-side flow in
   the read site calling the existing callables, never the Firestore client in
   the app. It is decided **with install-from-link data before the 2027 fiesta
   season**, which is why native analytics is the first piece of work.

## What this binds

- Web read routes are permanent. Every public entity detail and village route
  must resolve on the read site, with share previews and JSON-LD, because share
  links and the printed `/descarga` QR depend on them
  ([og-share-link-previews.md](og-share-link-previews.md),
  [qr-descarga.md](qr-descarga.md)). A new entity is not done until its read
  page exists.
- Spanish, village-first URLs stay exactly as they are
  ([spanish-village-urls.md](spanish-village-urls.md)): the same path opens the
  read page in a browser and the app screen through a universal link.
- Member-only data (private events, censo, personas) is never rendered on web.
- Until the read site replaces the Expo export, nothing that works on the
  current web build is removed. The switch happens route by route, never with a
  window in which a shared link is broken.
- An app feature never carries a web fallback, a `.web.*` twin or a web test.

## Rejected alternatives

- **Keep the Expo web export, cut down to read routes.** It still bundles the
  services, so the app's data layer stays on the JS SDK — the exact cost this
  decision removes.
- **Platform-split services** (`.native.ts` / `.web.ts` per service). Doubles
  the service layer and every mock.
- **Next.js on Cloud Run (ordago-web's shape).** Planned first, dropped at
  build time (2026-10-02): it needs a Cloud Run service, a container build and
  deploy-workflow changes in each of three projects, for ~13 read-only pages
  that need no client JavaScript. The read site is instead one Cloud Function,
  `readSite` (`functions/src/web/`), shipped by the existing functions deploy
  and cached at the Hosting edge. What made "grow `ogRenderer`" a poor option —
  hand-written HTML strings — is answered by a small escape-by-default template
  layer (`html.ts`), so user content can never become markup.
- **Drop web entirely.** Share previews, SEO and the printed QR need it.

## Revisit when

- The web sign-up question is decided (by 2027-04-30) — record the numbers and
  the answer here, including a "no".
- A non-anonymous web audience appears with real numbers (e.g. ayuntamientos
  asking for a desktop panel). Ordago runs an organizer web panel; that is the
  model if it ever comes.
