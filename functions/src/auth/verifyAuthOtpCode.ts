import { createHash } from 'crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { bucketIdFor } from './rateLimit';

const handler = 'verifyAuthOtpCode';

const OTP_COLLECTION = 'authOtpCodes';
const MAX_ATTEMPTS = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface VerifyAuthOtpCodeData {
  email?: string;
  code?: string;
}

interface VerifyAuthOtpCodeResult {
  token: string;
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

interface OtpDoc {
  codeHash: string;
  expiresAt: Timestamp;
  attempts: number;
  createdAt: Timestamp;
}

/** Core logic, separated from the onCall envelope so it is unit-testable. */
export async function runVerifyAuthOtpCode(
  data: VerifyAuthOtpCodeData | undefined,
): Promise<VerifyAuthOtpCodeResult> {
  const email = data?.email;
  const code = data?.code;

  if (typeof email !== 'string' || email.trim() === '' || !EMAIL_RE.test(email.trim())) {
    throw new HttpsError('invalid-argument', 'Email inválido.');
  }
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw new HttpsError('invalid-argument', 'Código inválido.');
  }

  const trimmedEmail = email.trim();
  const bucketId = bucketIdFor(trimmedEmail.toLowerCase());
  const db = getFirestore();
  const ref = db.collection(OTP_COLLECTION).doc(bucketId);

  const matched = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const otp = snap.data() as OtpDoc;
    if (otp.expiresAt.toMillis() < Date.now()) return false;
    if (otp.attempts >= MAX_ATTEMPTS) return false;
    if (otp.codeHash !== hashCode(code)) {
      tx.update(ref, { attempts: otp.attempts + 1 });
      return false;
    }
    tx.delete(ref);
    return true;
  });

  if (!matched) {
    logger.warn('auth otp verify rejected', { handler, bucketId });
    throw new HttpsError('invalid-argument', 'Código incorrecto o caducado.');
  }

  const auth = getAuth();
  let uid: string;
  try {
    const user = await auth.getUserByEmail(trimmedEmail);
    uid = user.uid;
  } catch (err) {
    if ((err as { code?: string } | null)?.code !== 'auth/user-not-found') {
      logger.error('getUserByEmail failed', {
        handler,
        bucketId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new HttpsError('internal', 'No se pudo verificar el código. Inténtalo de nuevo.');
    }
    const created = await auth.createUser({ email: trimmedEmail });
    uid = created.uid;
  }

  const token = await auth.createCustomToken(uid);
  logger.info('auth otp verified', { handler, bucketId });
  return { token };
}

export const verifyAuthOtpCode = onCall<VerifyAuthOtpCodeData, Promise<VerifyAuthOtpCodeResult>>(
  { region: 'us-central1', cors: true },
  async (request) => {
    // Unauthenticated by design — this IS the sign-in step.
    return runVerifyAuthOtpCode(request.data);
  },
);
