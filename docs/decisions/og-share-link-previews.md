# Open Graph previews via a Hosting-edge Cloud Function

## Context

The deeplink service produces working share URLs (`/event/<id>`, `/news/<id>`,
`/village/<id>`, `/o/<id>` plus their `/join` invite variants), but those URLs
return the SPA's empty `index.html` shell. Crawlers (WhatsApp, Twitter,
Facebook, iMessage, Slack, LinkedIn, Google) see no `<title>` or `<meta og:*>`,
so shared links render as bare URLs with no preview.

Earlier sessions tried Expo Router SSR on Cloud Run. That failed on two counts:
`expo export` in SDK 56 doesn't emit a per-request SSR module (only API routes +
middleware), and `firebase-admin` doesn't survive Expo's Hermes transform of the
code it does bundle. The real problem is small — `url → fetch one Firestore doc
→ return HTML with og:* injected` — which is a serverless-function shape, not a
long-running-server shape.

## Decision

One `onRequest` Cloud Function (`ogRenderer`, `europe-west1`) sits behind
Firebase Hosting rewrites for the four URL families (and `/join` variants),
placed **before** the `**` → `/index.html` catch-all. The SPA stays on the
existing static CDN for every other path — no continuously-running SSR server.

- **Fetchers** ([functions/src/og/fetchers.ts](../../functions/src/og/fetchers.ts))
  — four pure async reads over admin Firestore (`getEventOg`, `getNewsOg`,
  `getVillageOg`, `getOrgOg`), each returning `{ title, description, imageUrl }`
  or `null` on a missing doc. News og:image is a 7-day admin **signed URL** of
  the first image's storage path.
- **Injection** ([functions/src/og/html.ts](../../functions/src/og/html.ts)) —
  pure string transform inserting `<title>`, `og:*`, and `twitter:*`
  (`summary_large_image`) into `<head>`.
- **SPA shell** ([functions/src/og/spaShell.ts](../../functions/src/og/spaShell.ts))
  — lazily fetches the site's own `/index.html` once per cold start, cached in
  module state with a 1h TTL, so the function never needs redeploying when the
  SPA is rebuilt. Falls back to a thin HTML skeleton (og:* + `<noscript>` link)
  if the fetch fails, so crawlers still get metadata.
- **Router** ([functions/src/og/render.ts](../../functions/src/og/render.ts)) —
  branches by path prefix, returns the shell with defaults (never a 404) on a
  missing doc, sets `Cache-Control: public, max-age=600, s-maxage=3600`.
- Rewrites live in [firebase.json](../../firebase.json); coverage is locked by
  [functions/src/__tests__/handlers/og/render.test.ts](../../functions/src/__tests__/handlers/og/render.test.ts).

Per-resource og:* mapping (as implemented):

| URL           | og:title            | og:description                    | og:image                                          |
|---------------|---------------------|-----------------------------------|---------------------------------------------------|
| `/event/<id>` | `event.title`       | ~200 chars of `event.description` | `event.imageURL` ?? `villageCoverImage`           |
| `/news/<id>`  | `post.title`        | ~200 chars of `post.body`         | signed URL of `post.images[0].storagePath` (7d)   |
| `/village/<id>` | `municipality.name` | ~200 chars of `community.description` | `escudoManualUrl` ?? `escudoThumbUrl` ?? `escudoUrl` |
| `/o/<id>`     | `org.name`          | ~200 chars of `org.description`   | `org.imageURL`                                    |

`/join` variants share the parent resource's metadata but are cached under
distinct URL keys, so invite copy can diverge later without a cache collision.

## Rejected alternatives

- **Per-request SSR (Expo Router on Cloud Run).** No remaining use case justifies
  a runtime server; the SDK-56 export + `firebase-admin`/Hermes issues made it
  the harder path for a strictly smaller problem.
- **`generateStaticParams` pre-rendering.** Wouldn't cover user-generated events/
  news/orgs uniformly; the function covers all four resource families with one
  code path.
- **Branch.io / dynamic-link providers.** Third-party dependency and cost for a
  problem solvable with one $0-at-our-scale function.

## Status and follow-ups

Shipped and **verified on dev** (`villa-events`): function deployed to
`europe-west1`, Hosting rewrites live, curl against real docs returns populated
og:* tags, and a **real-phone WhatsApp preview renders** (image + title) — the
strictest of the three target crawlers. Beta/prod rollout is deferred as a
**project-wide phase decision**, not og-specific unfinished work: the whole app
is still in dev, so this feature is not special.

Two items to carry when the app moves past dev:

1. **Beta + prod deploy.** Redeploy `ogRenderer` + hosting to each, then
   re-validate WhatsApp / Twitter Card Validator / FB Sharing Debugger.
2. **Prod cache header (unresolved — verify, don't assume).** The global
   `Cache-Control: no-cache, no-store, must-revalidate` on the `**` header glob
   in [firebase.json](../../firebase.json) currently clobbers the function's own
   `public, max-age=600, s-maxage=3600`, so every OG request hits Firestore.
   Fine for dev (fresh previews while iterating); wasteful in prod. The intended
   fix is a `hosting.headers` override for `/event/*`, `/news/*`, `/village/*`,
   `/village/*/join`, `/o/*`, `/o/*/join` matching the function directive —
   **but Firebase does not document header-precedence when multiple globs match
   the same path** (first-match is documented only for redirects/rewrites). Do
   not assume the override wins: after adding it, deploy to a non-prod project
   and `curl -sI` an OG URL to confirm the response carries `max-age=600,
   s-maxage=3600` and not `no-store`. If it still shows `no-store`, the `**`
   entry is winning and the header config needs a different structure.

### Implementation note

Inside Cloud Run the `host` header is the `run.app` URL, not the Hosting domain;
`render.ts` reads `x-forwarded-host` first so the SPA-shell self-fetch targets
the CDN (fix in commit `e2258f8`).
