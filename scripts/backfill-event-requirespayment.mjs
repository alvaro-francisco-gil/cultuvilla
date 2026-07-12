#!/usr/bin/env node
/**
 * backfill-event-requirespayment.mjs
 *
 * One-off dev backfill for the new `requiresPayment` event field: for every
 * event doc in dev Firestore that lacks `requiresPayment`, patch it to
 * `false` — the same default the model builder uses.
 *
 * USAGE
 *   node scripts/backfill-event-requirespayment.mjs
 *
 * Idempotent: re-runs only patch docs where `requiresPayment` is still
 * missing (an existing true/false value is never overwritten).
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
  const snap = await db.collection('events').get();
  console.log(`Loaded ${snap.size} event docs.`);

  let needsPatch = 0;
  let alreadyCorrect = 0;
  let batch = db.batch();
  let inBatch = 0;
  let committed = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.requiresPayment !== undefined) {
      alreadyCorrect++;
      continue;
    }
    batch.update(docSnap.ref, { requiresPayment: false });
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
  if (inBatch > 0) {
    await batch.commit();
    committed += inBatch;
  }

  console.log(`\nDone.`);
  console.log(`  Already has field: ${alreadyCorrect}`);
  console.log(`  Patched:           ${needsPatch}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
