# OTP-code email sign-in

**Goal:** Replace the magic-link email sign-in flow with a 6-digit code so email sign-in completes in the same browsing session that requested it — fixing "device not remembered" for email users.

## Context

Google sign-in (`signInWithPopup`/`signInWithCredential`) completes entirely within the tab/app instance that's already running, so the persisted session lands exactly where the app reads it on next launch. Email sign-in instead sends a clickable magic link; the user taps it from their mail app, which very often opens a *different* browser/webview (in-app browser, different default browser) than the one running the app. Sign-in succeeds there, but that session lives in different storage than the one the running app will check next time — so the "device" is never remembered.

Fully replacing the link with a numeric code closes this gap: the user never leaves the tab they're already in, so it behaves like Google's flow.

Native app release (once Universal Links/App Links for `/finish` are wired up) would reduce, but not eliminate, this problem for users with the native app installed — link hand-off to a native app isn't 100% reliable, and the web build (the only thing shipped today, per the web-first policy in `AGENTS.md`) is unaffected regardless of native release status. So this fix is needed independent of release timing.

**Out of scope:** the re-authentication step used by `changeEmail` (Settings → change email) also uses an email link today (`completeReauth` / `EmailAuthProvider.credentialWithLink`). It relies on a real Firebase-issued email-link credential that has no OTP-code equivalent, and it isn't the flow behind the reported bug (it's a one-off in-session confirmation, not persisted login) — left untouched.

## Design

### Backend (`functions/src/auth/`)

- New Firestore collection `authOtpCodes/` — server-only infra collection (same category as the existing `authEmailRateLimits/`, no `municipalityId`, never touched by client Firestore rules, since Admin SDK bypasses rules entirely — no rules/indexes changes needed). Doc id = `sha256(lowercased email)` (reuse the existing `bucketIdFor` helper). Shape: `{ codeHash: string, expiresAt: Timestamp, attempts: number, createdAt: Timestamp }`.
- `sendAuthOtpCode` callable (replaces `sendAuthSignInEmail`): validates email, reuses the existing rate-limit check (5 sends / 15 min per email hash, same generic `{ok:true}` response on rate-limit so callers can't distinguish it), generates a random 6-digit code, stores `sha256(code)` + `expiresAt = now + 10 min` + `attempts: 0` (overwriting any prior pending code for that email), emails the code via Resend using an updated template.
- `verifyAuthOtpCode` callable: input `{ email, code }`. Loads the `authOtpCodes` doc for that email's bucket id.
  - Missing doc / expired → `invalid-argument` ("code expired or not found").
  - `attempts >= 5` → `invalid-argument` ("too many attempts"), doc left in place (already exhausted; a fresh `sendAuthOtpCode` call overwrites it).
  - Hash mismatch → increment `attempts`, throw `invalid-argument` ("incorrect code").
  - Match → delete the doc (single-use), get-or-create the Firebase Auth user by email (`getUserByEmail`, catch `auth/user-not-found` → `createUser({ email })`, matching what `generateSignInWithEmailLink` does implicitly today), mint `createCustomToken(uid)`, return `{ token }`.
- `authEmailTemplate.ts`: add a code-rendering template (`renderAuthOtpEmailHtml`/`Text`) alongside (not replacing — reauth still needs the link template) the existing link template. Plain code displayed prominently; no clickable action button needed.

### Shared client (`packages/shared/src/services/authEmailService.ts`)

- Add `sendAuthOtpCode(email): Promise<void>` and `verifyAuthOtpCode(email, code): Promise<string>` (returns the custom token) calling the two new callables.
- Keep `sendAuthSignInEmail` export as-is — `changeEmail`'s reauth-link send keeps calling it under its current name; only its *usage* narrows to reauth-only (its underlying `functions/src/auth/sendAuthSignInEmail.ts` callable is untouched — it doesn't know or care who calls it, and reauth still needs a real Firebase email-link credential).

### Mobile (`apps/mobile/lib/auth/AuthContext.tsx`)

- Replace `sendEmailLink`/`completeEmailLinkSignIn`/`isEmailLink`/`readPendingEmail`/`getEmailLinkContinueUrl` (the sign-in-specific exports) with:
  - `sendOtpCode(email): Promise<void>` → calls `sendAuthOtpCode`.
  - `verifyOtpCode(email, code): Promise<void>` → calls `verifyAuthOtpCode`, then `signInWithCustomToken(getAuth(), token)`.
- `PENDING_EMAIL_KEY`/`AsyncStorage` bookkeeping for pending sign-in email is dropped — no cross-context handoff needed since the user never leaves the screen.
- Leave `isSignInWithEmailLink`, `signInWithEmailLink`, `getEmailLinkContinueUrl` (renamed/kept for reauth only), `completeReauth`, `PENDING_REAUTH_KEY` untouched — reauth keeps using links.

### Mobile (`apps/mobile/app/(auth)/login.tsx`)

- Two-step form: email → "send code" (`sendOtpCode`), then reveal a code input + "verify" (`verifyOtpCode`). Add a "resend code" affordance reusing `sendOtpCode`.

### Mobile (`apps/mobile/app/(auth)/finish.tsx`)

- Drop the plain sign-in branches (`readPendingEmail`/`needs-email`/`tryComplete` for sign-in) — no link is emailed for sign-in anymore, so `/finish` is only ever reached via the reauth link. Keep the `pendingReauth` branch and its `completeReauth` call as-is.

### i18n

- Add new strings for the code-entry step (`packages/i18n/messages/es.json`) under the existing `auth.*` namespace; remove now-unused `auth.emailLinkHint`/`auth.emailLinkSent`/`auth.emailLink.*` sign-in-specific keys (keep the reauth-specific ones used by `finish.tsx`'s `pendingReauth` branch).

## File Structure

- `functions/src/auth/sendAuthOtpCode.ts` — new
- `functions/src/auth/verifyAuthOtpCode.ts` — new
- `functions/src/auth/sendAuthSignInEmail.ts` — unchanged (kept for reauth-link sends only)
- `functions/src/auth/authEmailTemplate.ts` — modify (add code template alongside the existing link template)
- `functions/src/index.ts` (or wherever callables are re-exported) — modify
- `functions/src/__tests__/handlers/sendAuthOtpCode.test.ts` — new
- `functions/src/__tests__/handlers/verifyAuthOtpCode.test.ts` — new
- `functions/src/__tests__/handlers/sendAuthSignInEmail.test.ts` — unchanged
- `packages/shared/src/services/authEmailService.ts` — modify
- `packages/shared/test/services/authEmailService.test.ts` — new/modify
- `apps/mobile/lib/auth/AuthContext.tsx` — modify
- `apps/mobile/lib/auth/__tests__/*.test.tsx` — modify (sign-in-related cases)
- `apps/mobile/app/(auth)/login.tsx` — modify
- `apps/mobile/app/(auth)/finish.tsx` — modify
- `apps/mobile/app/(auth)/__tests__/finish.test.tsx` — modify
- `packages/i18n/messages/es.json` — modify

## Tasks

### Stage 1 — Backend

- [ ] Add `authOtpCodes` doc read/write helpers + `sendAuthOtpCode` callable in `functions/src/auth/sendAuthOtpCode.ts`, reusing `bucketIdFor`/rate-limit logic from the existing file.
- [ ] Add code template to `authEmailTemplate.ts`.
- [ ] Add `verifyAuthOtpCode` callable in `functions/src/auth/verifyAuthOtpCode.ts` (expiry, attempts, hash check, get-or-create user, custom token mint).
- [ ] Register both callables wherever functions are exported.
- [ ] Emulator-backed handler tests for both callables (mirror `sendAuthSignInEmail.test.ts`'s pattern): valid send, malformed email, rate-limit, wrong code increments attempts, expired code rejected, lockout after 5 attempts, correct code returns a usable custom token, get-or-create for a brand-new email.

### Stage 2 — Shared service

- [ ] Update `authEmailService.ts`: add `sendAuthOtpCode`/`verifyAuthOtpCode`, remove the sign-in-only `sendAuthSignInEmail` export per Stage 1's naming decision.
- [ ] Update/add vitest coverage.

### Stage 3 — Mobile

- [ ] Update `AuthContext.tsx`: add `sendOtpCode`/`verifyOtpCode`, remove sign-in-specific link plumbing, update `AuthContextValue` interface.
- [ ] Update `login.tsx`: two-step email → code UI, resend affordance.
- [ ] Update `finish.tsx`: drop sign-in link branches, keep reauth branch.
- [ ] Update i18n strings.
- [ ] Update/add Jest tests for `AuthContext`, `login.tsx`, `finish.tsx`.

### Stage 4 — Verification

- [ ] `pnpm test:functions`, `pnpm app:test`, `pnpm shared:test`.
- [ ] `pnpm app:typecheck`, `pnpm typecheck`.
- [ ] Manual smoke test: request code, receive email (dev — check emulator/Resend test mode), enter code, confirm sign-in completes and persists across a reload.
- [ ] Update `CHANGELOG.md` under `[Unreleased]`.
