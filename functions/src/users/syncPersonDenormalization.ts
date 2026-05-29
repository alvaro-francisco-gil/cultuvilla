import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Keeps users/{uid}.displayName in sync with the linked persons/{personId} doc.
 *
 * Source of truth: persons/{personId} (givenName + middleNames[] + firstSurname
 *   + secondSurname).
 * Read target:   users/{persons.userId}.displayName, computed via the same
 *   buildDisplayName projection the UI uses.
 *
 * The trigger fires on every write to a person doc (create, update, delete).
 * It short-circuits when the projected displayName is unchanged so unrelated
 * person mutations don't fan out a no-op user write.
 */
export const syncPersonDenormalization = onDocumentWritten(
  { document: 'persons/{personId}', region: 'us-central1' },
  async (event) => {
    const handler = 'syncPersonDenormalization';
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    // Delete: leave the user doc alone. The displayName is a snapshot — it
    // stays valid even if the source persona is removed. Reads downstream can
    // decide whether to clear it via a separate flow.
    if (!after) return;

    const userId = (after['userId'] as string | undefined) ?? null;
    if (!userId) return;

    const beforeName = before ? projectName(before) : null;
    const afterName = projectName(after);
    if (beforeName === afterName) return;

    const userRef = db.doc(`users/${userId}`);
    const userSnap = await userRef.get();
    if (userSnap.exists && userSnap.get('displayName') === afterName) return;

    // set(merge:true) — handles both "user doc exists" (update displayName) and
    // "user doc not yet created" (onboarding writes person first; the client's
    // subsequent createUserProfile call merges email/telephone/etc. on top
    // without touching displayName). Admin SDK bypasses firestore.rules.
    await userRef.set({ displayName: afterName }, { merge: true });
    logger.info('users.displayName propagated', {
      handler,
      personId: event.params.personId,
      userId,
      createdUserDoc: !userSnap.exists,
    });
  },
);

function projectName(person: FirebaseFirestore.DocumentData): string {
  const parts: string[] = [];
  const given = person['givenName'];
  if (typeof given === 'string' && given.length > 0) parts.push(given);
  const middle = person['middleNames'];
  if (Array.isArray(middle)) {
    for (const m of middle) {
      if (typeof m === 'string' && m.length > 0) parts.push(m);
    }
  }
  const first = person['firstSurname'];
  if (typeof first === 'string' && first.length > 0) parts.push(first);
  const second = person['secondSurname'];
  if (typeof second === 'string' && second.length > 0) parts.push(second);
  return parts.join(' ');
}
