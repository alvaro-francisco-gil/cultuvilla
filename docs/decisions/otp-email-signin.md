# Email sign-in by 6-digit code

## Context

Email sign-in used a Firebase magic link: the app emailed a link, the user tapped it
from their mail app, and `/finish` completed the sign-in. Google sign-in
(`signInWithPopup` / `signInWithCredential`) instead completes inside the tab that is
already running, so its session lands exactly where the app looks on next launch.

The link almost never opened in that tab. Mail clients open an in-app webview or a
different default browser, so sign-in succeeded in *that* storage and the running app
never saw it — email users were never "remembered" the way Google users were. This is
a property of the hand-off, not of the native build: the web export (the only thing
shipped, per the web-first policy in `AGENTS.md`) has no way to route the link back,
and even Universal/App Links would only reduce the miss rate. See
[auth-and-persona-onboarding](auth-and-persona-onboarding.md) for the surrounding
passwordless model.

## Decision

- **A 6-digit code replaces the sign-in link.** `sendAuthOtpCode` emails the code;
  the user types it back into the same screen (`apps/mobile/app/(auth)/login.tsx`,
  two-step email → code with a resend affordance) and `verifyAuthOtpCode` returns a
  custom token the client exchanges via `signInWithCustomToken`. The user never leaves
  the session that requested the code, so persistence behaves like Google's flow.
- **Re-authentication (Settings → change email) still uses a link.** It needs a real
  Firebase-issued email-link credential (`EmailAuthProvider.credentialWithLink`), which
  has no code equivalent, and it is an in-session confirmation rather than a persisted
  login — the bug never applied to it. `sendAuthSignInEmail` and `/finish`'s reauth
  branch survive for that path alone.
- **Codes are stored hashed, in a server-only collection.** `authOtpCodes/{sha256(email)}`
  holds `{ codeHash, expiresAt, attempts, createdAt }` — no plaintext, no
  `municipalityId`, never read by a client. Like `authEmailRateLimits/` it is Admin-SDK
  only, so it needs no `firestore.rules` or index entry.
- **10-minute expiry, 5 attempts, single use, and one pending code per email.** Verify
  runs as a transaction: it increments `attempts` on a mismatch and deletes the doc on a
  match. A fresh send overwrites whatever was pending. The existing send rate limit
  (5 per 15 min per email hash) is shared with the link path via `functions/src/auth/rateLimit.ts`.
- **Every rejection returns one message.** Expired, exhausted, unknown, and wrong all
  surface as `invalid-argument` "Código incorrecto o caducado", and a rate-limited send
  still answers `{ ok: true }` — a caller cannot probe which emails have accounts or
  which codes exist. Cloud Logging keeps the distinction via the `bucketId`.
- **`verifyAuthOtpCode` is unauthenticated and creates the user if absent** — it *is*
  the sign-in step, and `getUserByEmail` → `createUser` reproduces what
  `generateSignInWithEmailLink` did implicitly.

## The signing-permission incident

The flow shipped in v0.17.0 and **never once succeeded in production** until v0.18.0.
`createCustomToken()` does not sign locally; it calls the IAM Credentials API as the
Cloud Functions runtime service account, which must hold
`roles/iam.serviceAccountTokenCreator` **on itself**. That binding was never granted, so
every correct code died at the last step with `auth/insufficient-permission`.

No test could have caught it: **the Auth emulator stubs token signing and never contacts
IAM**, so the full suite passed against three projects where the feature was broken. The
plan's one unchecked task was the manual smoke test against a real project.

Two things changed as a result:

- The binding is applied to dev, beta and prod.
- `scripts/check-custom-token-signing.mjs` runs as a pre-deploy gate in
  [deploy-firebase.yml](../../.github/workflows/deploy-firebase.yml), before the first
  `firebase deploy`, on every env — a project missing the binding blocks the pipeline
  instead of shipping a dead auth path.

The general lesson, beyond custom tokens: **an emulator that stubs a cloud API turns a
green suite into evidence about the emulator, not about the project.** Any code path
whose real dependency is IAM, Resend, or another stubbed-out service needs either a
deploy-time gate against the live project or a manual smoke test before it counts as
verified.

## Rejected alternatives

- **Waiting for the native release.** Universal/App Link hand-off is not reliable, and
  the web build — the only shipped target — would stay broken regardless.
- **Keeping the link and storing the pending email for cross-context pickup.** The
  storage the link opens in is not the storage the app reads; there is nothing to hand
  off to.
- **Distinguishing expired / exhausted / wrong in the error.** Cheap account and code
  enumeration for no user-visible benefit.
