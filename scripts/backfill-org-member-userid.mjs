#!/usr/bin/env node
/**
 * backfill-org-member-userid.mjs
 *
 * One-off: for every organizations/{orgId}/members/{userId} doc in dev
 * Firestore that lacks `userId`, set it to the doc id and patch the doc.
 *
 * USAGE
 *   node scripts/backfill-org-member-userid.mjs
 *
 * Idempotent: re-runs only patch docs whose `userId` is still missing.
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'villa-events';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS is not set.');
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

if (admin.app().options.projectId !== PROJECT_ID) {
  console.error(`Refusing to run against ${admin.app().options.projectId} — dev only.`);
  process.exit(1);
}

async function main() {
  const orgsSnap = await db.collection('organizations').get();
  console.log(`Loaded ${orgsSnap.size} organization docs.`);

  let needsPatch = 0;
  let alreadyCorrect = 0;
  let batch = db.batch();
  let inBatch = 0;
  let committed = 0;

  for (const orgSnap of orgsSnap.docs) {
    const membersSnap = await orgSnap.ref.collection('members').get();
    for (const memberSnap of membersSnap.docs) {
      const data = memberSnap.data();
      if (data.userId === memberSnap.id) {
        alreadyCorrect++;
        continue;
      }
      batch.update(memberSnap.ref, { userId: memberSnap.id });
      needsPatch++;
      inBatch++;
      if (inBatch >= 400) {
        await batch.commit();
        committed += inBatch;
        console.log(`  Committed ${committed}/${needsPatch} patches so far...`);
        batch = db.batch();
        inBatch = 0;
      }
    }
  }
  if (inBatch > 0) {
    await batch.commit();
    committed += inBatch;
  }

  console.log(`\nDone.`);
  console.log(`  Already correct: ${alreadyCorrect}`);
  console.log(`  Patched:         ${needsPatch}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
