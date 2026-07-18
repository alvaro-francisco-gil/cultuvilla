// packages/shared/src/services/authEmailService.ts
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '../firebase';

/**
 * Sends the branded Cultuvilla sign-in email for `email`, via the
 * `sendAuthSignInEmail` callable (Admin SDK link generation + Resend
 * delivery — see functions/src/auth/sendAuthSignInEmail.ts). `continueUrl` is
 * the client-built redirect target (mirrors AuthContext's
 * getEmailLinkContinueUrl()); the Admin SDK can't derive it server-side.
 */
export async function sendAuthSignInEmail(email: string, continueUrl: string): Promise<void> {
  const fn = httpsCallable<{ email: string; continueUrl: string }, { ok: true }>(
    getFirebaseFunctions(),
    'sendAuthSignInEmail',
  );
  await fn({ email, continueUrl });
}
