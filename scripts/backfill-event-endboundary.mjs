#!/usr/bin/env node
/**
 * backfill-event-endboundary.mjs
 *
 * One-off: for every event doc in dev Firestore, derive `endBoundary` from
 * `endDate ?? startDate` (the same rule buildEventData / eventEndBoundary use)
 * and patch the doc when it is missing or stale. `endBoundary` is the feed's
 * range/order key (see feedService.getUpcomingFeed); the strict converter now
 * requires it, so stale events would otherwise crash any screen that reads them.
 *
 * USAGE
 *   node scripts/backfill-event-endboundary.mjs
 *
 * Idempotent: re-runs only patch docs whose `endBoundary` is missing or wrong.
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
  let skipped = 0;
  let batch = db.batch();
  let inBatch = 0;
  let committed = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    // startDate is a required Timestamp; skip anything malformed rather than guess.
    if (!(data.startDate instanceof admin.firestore.Timestamp)) {
      skipped++;
      continue;
    }
    const endDate = data.endDate instanceof admin.firestore.Timestamp ? data.endDate : null;
    const want = endDate ?? data.startDate;

    if (data.endBoundary instanceof admin.firestore.Timestamp && data.endBoundary.isEqual(want)) {
      alreadyCorrect++;
      continue;
    }
    batch.update(docSnap.ref, { endBoundary: want });
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
  console.log(`  Already correct: ${alreadyCorrect}`);
  console.log(`  Patched:         ${needsPatch}`);
  console.log(`  Skipped (no startDate): ${skipped}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
