import { createHash } from 'crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { Resend } from 'resend';
import { RESEND_API_KEY } from './secret';
import {
  renderAuthEmailHtml,
  renderAuthEmailText,
  AUTH_EMAIL_SUBJECT_PREFIX,
} from './authEmailTemplate';

const handler = 'sendAuthSignInEmail';

const db = getFirestore();

// Pre-auth/global rate limiting has no municipality to scope by, so this is
// the one top-level collection that doesn't carry a `municipalityId`
// (AGENTS.md §3 is about domain entities; this is infrastructure).
const RATE_LIMIT_COLLECTION = 'authEmailRateLimits';
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_SENDS = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SendAuthSignInEmailData {
  email?: string;
  continueUrl?: string;
}

interface SendAuthSignInEmailResult {
  ok: true;
}

function bucketIdFor(email: string): string {
  return createHash('sha256').update(email).digest('hex');
}

/**
 * Atomically check-and-increment the fixed-window counter for `bucketId`.
 * Returns true when the send should proceed, false when the caller is over
 * the window's limit (in which case the send must be skipped, not the
 * response — see runSendAuthSignInEmail).
 */
async function checkRateLimit(bucketId: string): Promise<boolean> {
  const ref = db.collection(RATE_LIMIT_COLLECTION).doc(bucketId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Timestamp.now();
    if (!snap.exists) {
      tx.set(ref, { count: 1, windowStart: now });
      return true;
    }
    const data = snap.data() as { count: number; windowStart: Timestamp };
    const windowAgeMs = now.toMillis() - data.windowStart.toMillis();
    if (windowAgeMs > RATE_LIMIT_WINDOW_MS) {
      tx.set(ref, { count: 1, windowStart: now });
      return true;
    }
    if (data.count >= RATE_LIMIT_MAX_SENDS) {
      return false;
    }
    tx.update(ref, { count: data.count + 1 });
    return true;
  });
}

/** Core logic, separated from the onCall envelope so it is unit-testable. */
export async function runSendAuthSignInEmail(
  data: SendAuthSignInEmailData | undefined,
): Promise<SendAuthSignInEmailResult> {
  const email = data?.email;
  const continueUrl = data?.continueUrl;

  if (typeof email !== 'string' || email.trim() === '' || !EMAIL_RE.test(email.trim())) {
    throw new HttpsError('invalid-argument', 'Email inválido.');
  }
  if (typeof continueUrl !== 'string' || continueUrl.trim() === '') {
    throw new HttpsError('invalid-argument', 'continueUrl requerido.');
  }

  const trimmedEmail = email.trim();
  const bucketId = bucketIdFor(trimmedEmail.toLowerCase());

  const allowed = await checkRateLimit(bucketId);
  if (!allowed) {
    // Generic response on purpose — never let a caller distinguish
    // "rate-limited" from "sent" (docs/plans/ideas/branded-auth-email-delivery.md).
    // TODO: this only rate-limits by email hash; per-IP limiting is an open
    // question in the plan and out of scope for this first cut.
    logger.warn('auth email rate limited', { handler, bucketId, reason: 'window-exceeded' });
    return { ok: true };
  }

  let actionUrl: string;
  try {
    actionUrl = await getAuth().generateSignInWithEmailLink(trimmedEmail, {
      url: continueUrl,
      handleCodeInApp: true,
    });
  } catch (err) {
    logger.error('generateSignInWithEmailLink failed', {
      handler,
      bucketId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new HttpsError('internal', 'No se pudo generar el enlace de acceso. Inténtalo de nuevo.');
  }

  const timestamp = new Date().toISOString();
  const subject = `${AUTH_EMAIL_SUBJECT_PREFIX} · ${timestamp}`;
  const html = renderAuthEmailHtml({ actionUrl });
  const text = renderAuthEmailText({ actionUrl });

  try {
    const resend = new Resend(RESEND_API_KEY.value());
    // The Resend SDK does not throw on API-level failures — it resolves with
    // { data: null, error } instead, so a bad request would silently look
    // like a successful send if `error` went unchecked.
    const { error } = await resend.emails.send({
      from: 'Cultuvilla <hola@acceso.cultuvilla.es>',
      to: trimmedEmail,
      replyTo: 'cultuvilla.app@gmail.com',
      subject,
      html,
      text,
    });
    if (error) {
      logger.error('resend send failed', { handler, bucketId, error: error.message });
      throw new HttpsError('internal', 'No se pudo enviar el email. Inténtalo de nuevo.');
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('resend send failed', {
      handler,
      bucketId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new HttpsError('internal', 'No se pudo enviar el email. Inténtalo de nuevo.');
  }

  logger.info('auth sign-in email sent', { handler, bucketId });
  return { ok: true };
}

export const sendAuthSignInEmail = onCall<
  SendAuthSignInEmailData,
  Promise<SendAuthSignInEmailResult>
>(
  { region: 'us-central1', cors: true, secrets: [RESEND_API_KEY] },
  async (request) => {
    // Unauthenticated by design: this is the entry point that lets a signed-out
    // user request a sign-in link in the first place.
    return runSendAuthSignInEmail(request.data);
  },
);
