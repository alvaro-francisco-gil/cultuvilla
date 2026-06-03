---
status: draft
created: 2026-06-03
---

# Deep link service — design spec

## Overview

A single, layered system for sharing four kinds of cultuvilla resources via a URL: events, news posts, villages, and organizations. The canonical share URL is an HTTPS link on a configurable host (Firebase Hosting today, a custom domain later). On a phone with the app installed, iOS Universal Links and Android App Links open the native app directly at the matching expo-router route. On a phone without the app, or on desktop, the same URL renders the existing Expo web export.

There are two link **families** with distinct semantics:

- **Content links** — events and news. "Look at this thing." Idempotent. Anyone with the URL can view it (subject to the underlying entity being public). No side effect on open.
- **Join links** — villages and organizations. Same URL also doubles as the share/view link, but when the viewer is not a member, the rendered screen surfaces a "Join" CTA. Stable, anyone-with-the-link semantics — no tokens, no expiry. Revocation is achieved by making the village/organization private.

The link-building logic lives in a single shared service (`packages/shared/src/services/deepLinkService.ts`) consumed by mobile, the web export, and any Cloud Function that needs to emit a shareable URL.

## Goals

- One shared module that owns "what a cultuvilla URL looks like" — used by mobile UI, web-route rendering, and Cloud Function emails.
- HTTPS Universal Links / App Links as the canonical share format — no scheme-only URLs in user-visible share copy, no `/launch/<type>/<id>` interstitial redirect pages.
- A host variable per environment (dev/beta/prod) so the canonical domain can migrate to `cultuvilla.app` (or similar) later by editing env vars + redeploying — no code changes required in the shared service.
- A small mobile-side glue layer that listens for incoming URLs and routes them through expo-router, including a stash-and-replay pattern for invite links that require authentication.
- Universal Links / App Links work on a fresh install: `associatedDomains` on iOS, autoverified `intentFilters` on Android, valid AASA and `assetlinks.json` served by Firebase Hosting on each env's host.

## Non-goals (V1)

- Server-issued single-use tokens or expiring invites for villages/organizations. The model is "stable, anyone with the link can join". Revisit if/when we need elevated-permission invites (e.g. granting an admin role).
- Open Graph / Twitter Card meta tags for social previews. Different concern — done by the route components themselves, not the deep link service.
- Short link aliases (`cv.link/xyz`, branded shorteners, etc.).
- Click analytics on share/invite URLs.
- Domain migration tooling. The host variable supports a future migration; the actual move (DNS, hosting old → new redirect, AASA on both hosts during cutover) is a separate work item.
- Email/SMS verification links, password reset links, Firebase Auth action links. These are owned by Firebase Auth and are out of scope.

## Architecture

Three layers, each with one responsibility.

### Layer 1 — Pure URL builder (`packages/shared`)

`packages/shared/src/services/deepLinkService.ts` exports pure functions. No `Linking`, no `expo-router`, no platform branches. Returns plain string URLs (and structured objects from `parse`). Same module runs in mobile, the Expo web export (web bundle uses the same code), Cloud Functions (Node), and vitest.

```ts
type LinkKind = 'content' | 'invite';

interface DeepLink {
  url: string;            // canonical https URL
  kind: LinkKind;
  resource: 'event' | 'news' | 'village' | 'organization';
  id: string;
}

interface ParsedDeepLink {
  kind: LinkKind;
  resource: 'event' | 'news' | 'village' | 'organization';
  id: string;
}

getEventLink(eventId: string): DeepLink
getNewsLink(newsId: string): DeepLink
getVillageInviteLink(villageId: string): DeepLink
getOrgInviteLink(orgId: string): DeepLink

parseLink(url: string): ParsedDeepLink | null
buildShareMessage(link: DeepLink, t: TranslateFn): string

getDeepLinkHost(): string  // reads Constants.expoConfig.extra.deepLinkHost
```

Implementation reads the host from `Constants.expoConfig?.extra?.deepLinkHost` (mobile + web export) or `process.env.DEEP_LINK_HOST` (functions runtime). Renaming `event` → `e` in a future iteration is a one-file change in this module.

### Layer 2 — Mobile glue (`apps/mobile/lib/deeplink/`)

The only place that knows about `expo-linking`, the OS Linking events, and `expo-router`. Tiny — its job is reactive routing, not URL construction.

- `useDeepLinkRouter()` hook mounted once at the root layout. On mount calls `Linking.getInitialURL()`; subscribes to `Linking.addEventListener('url', …)`.
- Each incoming URL passes through `parseLink`. If null (unknown URL), do nothing — let the OS open the browser as usual.
- For every parsed link, `router.replace(`/${resourcePath}/${id}`)` where `resourcePath` maps `organization` → `o` and is otherwise the resource name.
- Routing does not branch on `kind`. The destination screen handles auth-gated actions (the Join CTA on village/org screens already shows "Sign in to join" when signed out — matching web behavior).

The `kind` distinction exists so `buildShareMessage` can produce different copy ("Look at this event" vs. "Join this village"), and so analytics or future logic can differentiate intent — but it does not change routing.

### Layer 3 — Web rendering (no extra code)

The Expo web export already renders every route in the app tree. When a Universal Link lands on the web (because the app isn't installed, or because the user is on desktop), the route just renders. No `/launch/…` interstitial, no `DeepLinkRedirect.tsx`. Web is the fallback by construction.

## URL catalog

| Link type           | Canonical URL                                  | Resolves to (mobile + web)             | Prerequisite route                  |
|---------------------|------------------------------------------------|----------------------------------------|-------------------------------------|
| Event (content)     | `https://<host>/event/<eventId>`               | `app/event/[eventId].tsx`              | Exists                              |
| News (content)      | `https://<host>/news/<newsId>`                 | `app/news/[newsId].tsx`                | **New** — add stub at minimum       |
| Village invite      | `https://<host>/village/<villageId>`           | `app/village/[villageId]/index.tsx`    | Exists; needs non-member Join CTA   |
| Organization invite | `https://<host>/o/<orgId>`                     | `app/o/[orgId].tsx`                    | **New** — add stub at minimum       |

Rules:
- **Descriptive paths**, not shortened ones. Each path segment matches the expo-router file structure one-to-one, except `o/<orgId>` which abbreviates `organizations` to keep the share URL tight (organizations are the most often verbally shared link).
- Village link does double duty: same URL for "view this village" and "invite to this village". Whether the rendered screen shows a Join CTA is a runtime decision based on the viewer's membership state, not a URL family decision.
- No `?utm=` or query-string conventions in V1. The deep link service consumes only the path.

## Native configuration

Mobile `app.config.ts` adds per-env Universal Link / App Link declarations sourced from the same `deepLinkHost` variable:

```ts
ios: {
  bundleIdentifier: bundleIdPerEnv[env],
  supportsTablet: true,
  associatedDomains: [`applinks:${deepLinkHostPerEnv[env]}`],
},
android: {
  package: bundleIdPerEnv[env],
  adaptiveIcon: { /* … */ },
  intentFilters: [{
    action: 'VIEW',
    autoVerify: true,
    data: [{
      scheme: 'https',
      host: deepLinkHostPerEnv[env],
      pathPrefix: ['/event/', '/news/', '/village/', '/o/'],
    }],
    category: ['BROWSABLE', 'DEFAULT'],
  }],
},
extra: {
  // …existing extras…
  deepLinkHost: deepLinkHostPerEnv[env],
},
```

The existing `scheme: 'cultuvilla'` is retained — it is still the internal transport (the OS uses the scheme under the hood when forwarding the URL to the app) and is still useful as a dev-client fallback. It is not surfaced in user-visible share copy.

`deepLinkHostPerEnv` is sourced from environment variables with safe defaults:

```ts
const deepLinkHostPerEnv: Record<Env, string> = {
  dev:  process.env.DEEP_LINK_HOST_DEV  ?? 'villa-events-dev.web.app',
  beta: process.env.DEEP_LINK_HOST_BETA ?? 'villa-events-beta.web.app',
  prod: process.env.DEEP_LINK_HOST_PROD ?? 'villa-events.web.app',
};
```

*Note:* the exact dev/beta Firebase Hosting subdomains depend on the env spec; the canonical names will be confirmed during implementation against the dev-prod-environments spec.

## Hosting configuration

`firebase.json` gains a `Content-Type` header for the AASA file. Firebase Hosting serves static files before applying rewrites, so the catch-all `/index.html` rewrite will not intercept `/.well-known/*` as long as those files exist in `apps/mobile/dist/.well-known/` — which they do via the `public/` copy step below.

```jsonc
"hosting": {
  "public": "apps/mobile/dist",
  "ignore": ["firebase.json", "**/.*"],
  "rewrites": [
    { "source": "**", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/.well-known/apple-app-site-association",
      "headers": [{ "key": "Content-Type", "value": "application/json" }]
    }
  ]
}
```

Static well-known files live at `apps/mobile/public/.well-known/`:

- `apple-app-site-association` — no `.json` extension; JSON content; per-env Apple App ID prefix (`TEAMID.com.cultuvilla.app[.dev|.beta]`).
- `assetlinks.json` — SHA-256 fingerprints of the Android signing certs (EAS-managed prod cert; debug cert added for dev/beta envs if needed for App Link autoverify in development).

Expo web export copies `apps/mobile/public/**` into `dist/` during `expo export -p web`, so these files ship with each web deploy. The per-env file content (which bundle ID, which cert fingerprints) is selected at build time by `app.config.ts` via a small `scripts/render-well-known.ts` step run as `predeploy:hosting:<env>` — keeps three sets of source-of-truth files under `apps/mobile/public/.well-known/{dev,beta,prod}/` and copies the right one into `apps/mobile/public/.well-known/` before `expo export -p web`.

## Auth gating

Auth gating happens at the **screen** layer, not the routing layer — on both mobile and web.

- Opening any deep link (content or invite) routes the user straight to the destination screen, regardless of auth state.
- The destination screen reads `AuthContext` and `isMember` state and decides whether to show:
  - the resource (anyone can view a public event/village/news/organization),
  - a sign-in prompt (resource is private and viewer is signed out), or
  - a Join CTA (resource is public, viewer is signed out **or** signed in but not a member).
- After sign-in, the user remains on the same route because `router.replace` was already called with the destination — no stash/replay machinery is needed.

This keeps the deep-link layer agnostic of permission semantics, which belong to the screens.

## "Join" CTA on village and organization screens

Village and org screens compute `isMember` from the same source-of-truth they already use (`/municipalities/{id}/members/{userId}` for villages; an equivalent membership doc for orgs). When `isMember === false`, the screen surfaces a primary "Join this village" / "Join this organization" button. Clicking it:

- If the entity is public, calls the existing join service directly and re-renders.
- If the entity is private, calls the existing request-to-join service and shows "Request sent".

The deep link service does NOT own this UI — it only ensures the user lands on the right screen with the right membership state computed. The screens already have the membership-aware rendering for `/village/[villageId]/index.tsx`; the new `/o/[orgId]` stub must implement the equivalent.

## Composing share text

`buildShareMessage(link, t)` returns a localized one-line message suitable for `Share.share({ message })`, `mailto:`, or a WhatsApp deep link:

```
Te invito a ver "<entity-name>" en Cultuvilla: <url>
```

The message catalog key lives in `packages/i18n/messages/{es,en}.json` under a `deeplink.share.*` namespace (one key per resource type). Resource name is fetched by the caller — the service does not call Firestore.

## Testing strategy

- **Pure builders** (`getXxxLink`, `parseLink`, `buildShareMessage`): unit tests in `packages/shared/test/services/deepLinkService.test.ts` against fixed `expoConfig.extra.deepLinkHost` via test fixtures. Cover every resource type, round-trip (`parseLink(getXxxLink(id).url)` returns the expected structure), and parser rejection of unknown paths.
- **Mobile glue** (`useDeepLinkRouter`): RN testing library + mocked `expo-linking` and `expo-router`. Cover: initial URL routing, runtime URL routing, invite-while-signed-out stash-and-replay, malformed URL → no-op.
- **Native config**: snapshot the rendered `app.config.ts` output against expected `associatedDomains` and `intentFilters` for each env.
- **AASA / assetlinks**: JSON-schema validation against Apple's and Google's published schemas in a vitest test under `apps/mobile/test/`. Smoke test that the deployed file is reachable with the right `Content-Type` is a manual step on each deploy (added to the deploy runbook in `firestore-deploy` skill or a new `deploy-hosting` skill if needed).

## Migration path to a custom domain

When `cultuvilla.app` (or whichever final domain) is ready:

1. Point DNS at Firebase Hosting; add the custom domain in the Firebase console; serve AASA for the new host on the new domain.
2. Update `DEEP_LINK_HOST_PROD` env var.
3. Cut a new mobile build with the new `associatedDomains` / `intentFilters`.
4. Add a `villa-events.web.app` → `https://cultuvilla.app/*` rewrite on the old hosting target so old shared links continue to work (the OS will not open the app on the old domain anymore after the new build is installed, but the web fallback will redirect).
5. Optionally serve AASA on both domains for a transitional period so older app installs (with `villa-events.web.app` in their `associatedDomains`) keep working.

The shared service requires no changes for this migration — only the env var and a redeploy.

## Open questions

None blocking implementation. The following are deferred to the implementation plan or future work:

- Confirm the dev/beta Firebase Hosting subdomains against the dev-prod-environments spec.
- Decide whether `assetlinks.json` should pin only the EAS-managed prod cert, or include the debug cert too for dev builds. (Pinning only prod is the safer default; revisit if developers report App Links not autoverifying in dev builds.)
- Decide whether the `/o/[orgId]` stub renders a real organization detail screen or just a placeholder for V1. (Recommended: minimum viable detail screen — name, description, members count, Join CTA. The deeplink work shouldn't be blocked on a full org-detail design.)
