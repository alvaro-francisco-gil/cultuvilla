#!/usr/bin/env node
/**
 * backfill-terms-acceptance.mjs
 *
 * One-off: for every user doc in dev Firestore that lacks `termsVersion`, stamp
 * the current version and an acceptance timestamp. Existing accounts predate the
 * consent feature; the strict Zod converter now requires these fields, so a doc
 * missing them crashes any screen that reads it. We set `termsAcceptedAt` to the
 * doc's own `createdAt` (best available proxy for when the account was made),
 * falling back to a server timestamp when `createdAt` is absent.
 *
 * USAGE
 *   GOOGLE_APPLICATION_CREDENTIALS=<dev key> node scripts/backfill-terms-acceptance.mjs
 *
 * Idempotent: only patches docs whose `termsVersion` is missing.
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'villa-events';
const TERMS_VERSION = '1.0';

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
  const snap = await db.collection('users').get();
  console.log(`Loaded ${snap.size} user docs.`);

  let needsPatch = 0;
  let alreadyCorrect = 0;
  let batch = db.batch();
  let inBatch = 0;
  let committed = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.termsVersion) {
      alreadyCorrect++;
      continue;
    }
    batch.update(docSnap.ref, {
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: data.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
    });
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
