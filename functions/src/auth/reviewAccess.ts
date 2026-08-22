import { getFirestore } from 'firebase-admin/firestore';

// Store reviewers (Google Play "App access", Apple "App Review Information")
// have to sign in to evaluate everything the app gates behind an account. But
// sign-in here is a 6-digit code emailed to the address, so the only other way
// to let a reviewer in is to hand them the password of a real mailbox — a
// credential that then lives in a console form and is replayed on every update
// review. Instead exactly ONE allowlisted address gets a fixed code.
//
// The allowlist is a Firestore doc rather than a repo constant (the code must
// not be in git) and rather than a Secret Manager secret (a secret is read at
// deploy time, so enabling it would couple to a deploy in all three envs, and a
// missing secret fails the deploy outright). As a doc, enabling, rotating and
// revoking are one data write per environment, and an environment without the
// doc simply has no review account.
//
// `_admin/**` is denied to every client in firestore.rules and the Admin SDK
// bypasses rules; the path needs an even number of segments to be a document.
const REVIEW_ACCESS_DOC = '_admin/reviewAccess';

interface ReviewAccessDoc {
  email?: unknown;
  code?: unknown;
}

/**
 * The fixed sign-in code for the store-review account, or `null` for every
 * other address — the normal case, meaning "issue a random code as usual".
 *
 * Deliberately returns a code to be written into the SAME `authOtpCodes` doc a
 * random code would go to, so the caller changes only which digits are hashed.
 * Expiry, the 5-attempt cap and the send rate limit therefore apply unchanged,
 * which is what keeps a never-rotating code out of brute-force range.
 */
export async function reviewOtpCodeFor(email: string): Promise<string | null> {
  const snap = await getFirestore().doc(REVIEW_ACCESS_DOC).get();
  if (!snap.exists) return null;

  const { email: allowedEmail, code } = (snap.data() ?? {}) as ReviewAccessDoc;
  if (typeof allowedEmail !== 'string' || typeof code !== 'string') return null;

  // Exact full-string match on the normalised address. Never a prefix, suffix
  // or domain match — a loose comparison here is an open sign-in for everyone
  // whose address happens to contain the allowlisted one.
  if (allowedEmail.trim().toLowerCase() !== email.trim().toLowerCase()) return null;
  if (!/^\d{6}$/.test(code)) return null;

  return code;
}
