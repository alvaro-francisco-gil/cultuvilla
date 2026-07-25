import { createHash } from 'crypto';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Pre-auth/global rate limiting has no municipality to scope by, so this is
// one of the few top-level collections that doesn't carry a `municipalityId`
// (AGENTS.md §3 is about domain entities; this is infrastructure).
const RATE_LIMIT_COLLECTION = 'authEmailRateLimits';
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_SENDS = 5;

export function bucketIdFor(email: string): string {
  return createHash('sha256').update(email).digest('hex');
}

/**
 * Atomically check-and-increment the fixed-window counter for `bucketId`.
 * Returns true when the send should proceed, false when the caller is over
 * the window's limit (in which case the send must be skipped, not the
 * response — callers should still return a generic {ok:true}).
 */
export async function checkRateLimit(bucketId: string): Promise<boolean> {
  const db = getFirestore();
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
