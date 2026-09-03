import { observability } from '@cultuvilla/shared';

// A person who backs out of the Apple/Google sheet is not a defect. These
// codes would otherwise dominate the error stream and bury the real failures.
const CANCELLED_CODES = new Set([
  'auth/cancelled',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'ERR_REQUEST_CANCELED',
]);

export function isCancelledAuthError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && CANCELLED_CODES.has(code);
}

/**
 * Reports a sign-in failure to observability.
 *
 * Auth failures were the one class of error the project could never see. They
 * happen with no signed-in user, and `logClientError` used to reject an
 * unauthenticated call — so `sendClientError` swallowed the rejection and the
 * report vanished. Meanwhile `authErrorMessage` replaces every
 * `Firebase: Error (auth/…)` with generic copy, so the code never reached the
 * person on the screen either. Apple rejected 1.0.0 for a login error that
 * left no trace on either side of that gap.
 *
 * `operation` is what names the provider; the raw error carries `code` and
 * `message` through `toErrorPayload` in the adapter.
 */
export function reportAuthError(operation: string, error: unknown): void {
  if (isCancelledAuthError(error)) return;
  observability.captureError(error, { operation, surface: 'auth' });
}
