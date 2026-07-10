# Observability Foundation

Status: idea (design approved, not yet planned/implemented)

A coherent, long-term observability foundation across all three pillars —
crash/error reporting, product analytics, and system health — built web-first
but designed so the native apps plug in unchanged when they ship.

## Context

- **Backend already has real observability.** Cloud Functions use the
  `firebase-functions/v2` structured logger → Cloud Logging, with the
  `handler`-field convention enforced by a no-console test. This is the one
  mature piece and everything client-side should converge on the same store.
- **The client has nothing today.** No crash reporting, no analytics, no error
  boundaries, no shared client logger; a handful of stray `console.*` calls in
  `apps/mobile`.
- **Web-first release.** Only the Expo web build ships now; the native
  iOS/Android apps compile but are not published. Native lands in the coming
  months and is the real target — so the web phase is an interim step and must
  not accrue web-only dead weight.
- **Legal context.** GDPR-scoped (Spanish users, 14+ minimum age, guest
  browsing for unauthenticated users). The published privacy policy already
  names Google Analytics for Firebase + Crashlytics as processors, so both are
  pre-cleared even though unwired.
- **Sibling precedent.** `ordago-apps` (same author, same stack) has a mature
  observability stack we mined for patterns. We adopt its compliance posture and
  seam discipline; we deliberately skip its heavier machinery (server-side
  OpenTelemetry, a custom analytics→BigQuery pipeline, dbt marts, a dashboard
  Cloud Run gate, and running Sentry + Crashlytics in parallel).

## Guiding principle

**Invest in the seam; keep platform backends thin and swappable.** The durable
asset — the thing that makes the web→native transition a one-adapter change — is
a platform-free client observability *port* in `packages/shared`. Screens only
ever call the port. The web-specific backends are adapters that get *replaced*,
not rewritten around, when native ships. Compliance (PII hashing/scrubbing) is
made *structural* — enforced in one chokepoint — not left to per-call
discipline.

## Architecture — ports & adapters

```
┌─ screens / hooks ─────────────────────────────────────────┐
│   observability.trackEvent(...) / captureError(...) / log  │   ← the only API anyone calls
└───────────────────────┬───────────────────────────────────┘
                         │  imports from @cultuvilla/shared
┌───────────────────────▼─── packages/shared ───────────────┐
│  observabilityService.ts   (PORT — platform-free)          │
│   • the API surface + types                                │
│   • event taxonomy constants + payload builders            │
│   • consent gate + PII allowlist                           │
│   • no-op default impl (tests & unconfigured = silent)     │
│   • configureObservability(adapter)  ← DI seam             │
└───────────────────────┬───────────────────────────────────┘
              injected at bootstrap │
┌───────────────────────▼─── apps/mobile/lib/observability ──┐
│  analytics.web.ts    → firebase/analytics + Consent Mode   │  ADAPTERS
│  analytics.native.ts → stub now; @rnfirebase later         │  (Metro picks by ext)
│  errorBridge.ts      → global handler + logClientError call │
│  ErrorBoundary.tsx   → React boundary → captureError       │
└───────────────────────┬───────────────────────────────────┘
                         │ httpsCallable
┌───────────────────────▼─── functions/src ──────────────────┐
│  shared/observability.ts → log.* wrapper (hash uid + scrub)│
│  observability/logClientError.ts → structured Cloud Logging│ → Cloud Error Reporting
│  observability/getUserIdHash.ts  → returns hashed uid      │         → email alerts
└────────────────────────────────────────────────────────────┘
```

**Why DI/injection rather than the shared service importing Firebase directly:**
keeps `packages/shared` platform-free (avoids the documented web/native
module-leak gotcha), keeps it unit-testable via the no-op default, and makes the
native swap a *one-adapter change*. This honours the service-layer-ownership
rule: screens import the port from shared; only the adapter touches `firebase/*`.

## The seam API (durable contract)

```ts
observability.setUserContext({ uid, municipalityId, role })   // raw uid in; hashing handled server-side
observability.setConsent({ analytics: boolean })              // Consent Mode v2, denied-by-default
observability.trackEvent(name, params)                        // Firebase Analytics (web ≡ native API)
observability.captureError(error, context)                    // → logClientError callable + app_exception event
observability.logger.{info,warn,error}(msg, fields)           // client mirror of the v2 logger shape
observability.startOperation(flow, screen) → OperationContext // operation_id correlation across client+server
```

- **Fire-and-forget:** every send is `void send().catch(() => {})`. Observability
  must never break a user flow.
- **PII allowlist enforced in the port:** only
  `uid (→ hashed), municipalityId, villageId, role, appVersion, platform, route,
  operation_id` survive; any other key is dropped before it reaches an adapter.
  One place to defend.

## Identity & PII

The single highest-leverage idea, adopted from ordago: **make compliance
structural.**

- **HMAC-hashed UID.** New Secret Manager secret `OBSERVABILITY_USER_ID_SALT`
  (dev now; the `gcloud-cultuvilla` skill already reserves this slot). The **raw
  uid never appears in any telemetry store.** The observability identifier is
  `HMAC-SHA256(salt, firebase_uid)`.
- **Hashing happens server-side.** `logClientError` stamps the *authenticated*
  uid from the callable context and hashes it on receipt — the client cannot
  spoof identity and the salt never ships to clients. A tiny `getUserIdHash`
  callable returns the hash once per session (cached in `AsyncStorage` under a
  per-uid key) so the client can set it as the Firebase Analytics `userId` and
  attach it to `app_exception` events — keeping every store on the *same*
  non-PII id.
- **Server log chokepoint.** New `functions/src/shared/observability.ts` wraps
  the v2 logger with a `transformAttrs` step that auto-hashes any `user.id`
  attribute and runs `redactPII()` — email → `<email>`, phone-like digit runs →
  `<phone>`, and token-shaped strings → `<token>` via a Shannon-entropy
  `looksLikeToken` heuristic (≥ ~3.5 bits/char) so long normal words survive.
  Copied near-verbatim from ordago's `observability.ts`. **Rule: never hash or
  scrub at the call site** — domain code passes raw values, the wrapper cleans
  them. New handlers use this wrapper; existing handlers migrate opportunistically
  (not a big-bang rewrite).
- **Right to erasure** collapses to: delete the user doc (breaks the
  hash→identity bridge, already done by the account-deletion flow) + salt
  rotation as the nuclear option.

## Consent

Denied-by-default Google Consent Mode v2. Firebase Analytics boots in
cookieless/anonymized mode until the user opts in. `captureError` and `logger`
(no ad identifiers, minimal PII, crash-diagnosis purpose) ride legitimate
interest and keep flowing pre-consent; only the Analytics/profiling side waits
for opt-in. A **minimal** opt-in bar flips `setConsent({ analytics: true })`,
persisted in `AsyncStorage`. The consent *state/abstraction* is durable (native
needs it too for ATT + Consent Mode); the banner UI is deliberately small and
expendable — no CMP vendor. More justified here than in ordago because cultuvilla
has guest browsing (unauthenticated users) and 14+ minors; ordago has neither and
so skips consent.

## Analytics taxonomy

- Event-name **constants live in a central file in the port** so web and native
  emit identical events, and to avoid the inline-string drift ordago flagged in
  its own retro. Naming convention `<domain>.<action>.<outcome>`.
- A new `observability-conventions` skill doubles as the taxonomy review-gate and
  a debugging runbook (naming rules, the PII allowlist, gcloud/Error-Reporting
  filter recipes).
- **Starter funnels:** onboarding (start / age-gate / complete), village join,
  event signup, organization creation. Each event carries only allowlisted
  params.

## Crash capture

- **Web (now):** `ErrorBoundary` + a global handler (`ErrorUtils` /
  `window.onerror` / `unhandledrejection`) → `captureError` → both:
  1. the `logClientError` callable → structured Cloud Logging → **Cloud Error
     Reporting** (auto-groups by stack trace, emails on new/spiking errors), and
  2. an `app_exception` analytics event for funnel/impact correlation.
- **Native (later):** the `captureError` adapter body swaps to Crashlytics
  behind the vendor-neutral wrapper (safe `require`, fail-closed no-op so the SDK
  can never crash the app); the analytics-event half is unchanged. No Sentry —
  ordago's retro says pick one crash vendor from day one, and Crashlytics is the
  Firebase-native, cost-unlimited choice.

## Alerting

Cloud Error Reporting emails on new/spiking errors (solo-dev friendly, free, no
notification-channel setup). Alerts-as-code / Cloud Monitoring policies are
deferred until there is real traffic to tune thresholds against.

## Testing & rollout

**Tests**

- The port is pure → vitest in `packages/shared/test/`:
  - consent gate (analytics suppressed when denied; errors still flow),
  - PII allowlist strips disallowed keys,
  - `redactPII` / `looksLikeToken` cases (emails/phones/tokens scrubbed, normal
    words preserved),
  - taxonomy builders produce the expected event shape,
  - no-op default is safe when unconfigured,
  - `operation_id` threads start → step → success/error.
- `logClientError` + `getUserIdHash` → functions-emulator tests: auth required,
  uid is hashed (raw uid never appears in output), structured log shape carries
  the `handler` field.

**Rollout (dev first)**

1. Land the port + no-op default + adapters + the two callables + the server log
   chokepoint.
2. Create the `OBSERVABILITY_USER_ID_SALT` secret on dev; deploy the callables.
3. Wire `setUserContext` in `AuthContext`; wire `getUserIdHash` caching.
4. Add the `ErrorBoundary` + global handlers at the app root.
5. Instrument the four starter funnels.
6. Add the Cloud Error Reporting email alert.
7. Update `packages/shared/src/services/_services-map.md`, fill the reserved
   observability-salt section of the `gcloud-cultuvilla` skill, create the
   `observability-conventions` skill, note the change in `CHANGELOG.md`.

## Explicitly NOT doing (YAGNI)

Server-side OpenTelemetry, a custom analytics→BigQuery pipeline, dbt marts, a
dashboard Cloud Run gate, Sentry (Crashlytics-only path), distributed tracing,
session replay, and alerts-as-code IaC. Firebase Analytics has one-click BigQuery
export, so ordago-grade BI is reachable later without building any of that
plumbing — deferred until traffic justifies it.
