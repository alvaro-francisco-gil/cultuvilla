# OTP login E2E coverage

**Goal:** Add real Playwright E2E coverage of the login screen (`apps/mobile/app/(auth)/login.tsx`), currently untested end-to-end for either sign-in provider.

## Context

Every existing E2E spec (`apps/mobile/e2e/flows/*.spec.ts`) bypasses the login screen entirely via `apps/mobile/e2e/lib/fixtureLogin.ts`, which calls a test-only seam (`window.__cultuvillaE2E.login`) that signs in directly via `signInWithEmailAndPassword` against the emulator — no UI typing, no Google popup, no email code. This predates the OTP-code sign-in flow (see [otp-email-signin](../../decisions/otp-email-signin.md)) and isn't specific to it; the magic-link flow it replaced was equally untested end-to-end.

The gap is not academic: the OTP flow shipped in v0.17.0 and failed on every attempt in
production until v0.18.0 (the runtime service account could not sign custom tokens) — no
suite caught it because the Auth emulator stubs signing. A deploy-time gate now covers
that specific hole; end-to-end coverage of the screen itself is still missing.

Testing the real OTP flow is harder than it sounds: `authOtpCodes` only ever stores a hash of the code (`codeHash`), never the plaintext, so a test can't just read it out of the emulator's Firestore.

## Design / approach

Two options, either viable:

1. **Guarded test-only escape hatch.** Mirror the existing fixture-login seam's triple-guard pattern (emulator flag + `Platform.OS === 'web'` + runtime assertion that Auth is pointed at loopback) to expose the plaintext code somewhere test-readable only under those conditions. Write a Playwright spec that types an email into `login.tsx`, fetches the code via the seam, types it into the code field, and asserts sign-in completes.
2. **Intercept the Resend call** during the E2E run and parse the code out of the captured email payload instead of adding a new seam. Keeps the callable's real code path closer to production behavior but the interception plumbing is more fiddly to wire into the existing emulator-based E2E runner.

## Open questions

- Which of the two approaches to take (leaning option 1 — consistent with the existing seam pattern).
- Whether to also cover the Google sign-in popup, or scope this strictly to the OTP flow.
