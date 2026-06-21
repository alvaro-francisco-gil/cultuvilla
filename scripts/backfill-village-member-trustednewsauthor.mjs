#!/usr/bin/env node
/**
 * backfill-village-member-trustednewsauthor.mjs
 *
 * One-off: `VillageMemberDataSchema.trustedNewsAuthor` (z.boolean(), builder
 * default `false`) was added after some dev member docs already existed. Those
 * docs lack the key, so the strict converter throws `trustedNewsAuthor:
 * expected boolean, received undefined` when the village screen reads members —
 * crashing the whole screen. Set the field to the builder default (`false`) on
 * every village-member doc that is missing it.
 *
 * USAGE
 *   node scripts/backfill-village-member-trustednewsauthor.mjs
 *
 * Idempotent: only patches docs whose `trustedNewsAuthor` is still undefined.
 * Scoped to municipalities/{}/members via the ancestor path — `organizations/{}
 * /members` (OrgMember, a different schema without this field) is left alone,
 * even though both subcollections share the `members` collection-group id.
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'villa-events';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS is not set. See firebase-admin-dev skill.');
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

if (admin.app().options.projectId !== PROJECT_ID) {
  console.error(`Refusing to run against ${admin.app().options.projectId} — dev only.`);
  process.exit(1);
}

/** True for docs at municipalities/{id}/members/{uid} (not organizations/{id}/members/{uid}). */
function isVillageMember(docRef) {
  return docRef.parent.parent?.parent?.id === 'municipalities';
}

async function main() {
  const snap = await db.collectionGroup('members').get();
  console.log(`Scanned ${snap.size} 'members' docs (village + org).`);

  let patched = 0;
  let alreadyCorrect = 0;
  let skippedOrg = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const doc of snap.docs) {
    if (!isVillageMember(doc.ref)) {
      skippedOrg++;
      continue;
    }
    if (doc.data().trustedNewsAuthor !== undefined) {
      alreadyCorrect++;
      continue;
    }
    batch.update(doc.ref, { trustedNewsAuthor: false });
    patched++;
    inBatch++;
    if (inBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();

  console.log('\nDone.');
  console.log(`  Org members skipped:    ${skippedOrg}`);
  console.log(`  Village already correct: ${alreadyCorrect}`);
  console.log(`  Village patched:         ${patched}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
