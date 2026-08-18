// Holds the custom token minted by `verifyAuthOtpCode` between the callable
// returning and `signInWithCustomToken` succeeding.
//
// Why this exists: the callable deletes the OTP document *inside the same
// transaction that validates it* (functions/src/auth/verifyAuthOtpCode.ts), and
// only then creates the user and mints the token. So by the time the token is
// in flight the code is already spent. If the sign-in that follows fails — the
// classic flaky-connection case — re-running the callable would demand a fresh
// code the user doesn't have, while the account the server just created sits
// stranded. That is the "signup errored, then logging in again worked" report.
//
// Keeping the token lets a retry finish the sign-in that was already paid for.
//
// Memory only, deliberately: a custom token is a bearer credential and must not
// be persisted to AsyncStorage. The window that matters — the user tapping
// "Verificar" again — is well inside a single app session.

import { classifyCallableError } from '@cultuvilla/shared/services/callableErrors';

interface PendingToken {
  email: string;
  token: string;
}

let pending: PendingToken | null = null;

/** The unspent token for `email`, if the last attempt left one behind. */
export function getPendingToken(email: string): string | null {
  return pending && pending.email === email ? pending.token : null;
}

export function rememberPendingToken(email: string, token: string): void {
  pending = { email, token };
}

export function clearPendingToken(): void {
  pending = null;
}

/**
 * Whether a failed `signInWithCustomToken` leaves the token worth retrying.
 *
 * Only connection failures do. Anything else — an expired token
 * (`auth/invalid-custom-token`), a project mismatch, a disabled user — means
 * the token itself is bad, and holding it would trap the user in a loop of
 * retrying a credential that can never work instead of requesting a new code.
 */
export function shouldRetainToken(error: unknown): boolean {
  return classifyCallableError(error).kind === 'network';
}
