#!/usr/bin/env node
/**
 * backfill-festivalPoster-images.mjs
 *
 * One-off: migrate dev festivalPoster docs from the scalar `imageURL` to the
 * ordered `images: string[]` array. For each doc that still has `imageURL`, set
 * `images: [imageURL]` (or `[]` if null) and delete `imageURL`.
 *
 * USAGE
 *   node scripts/backfill-festivalPoster-images.mjs
 *
 * Idempotent: docs already migrated (no `imageURL` field) are skipped.
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
  const snap = await db.collection('festivalPosters').get();
  console.log(`Loaded ${snap.size} festivalPoster docs.`);

  let patched = 0;
  let skipped = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (!('imageURL' in data)) {
      skipped++; // already migrated
      continue;
    }
    const images = typeof data.imageURL === 'string' ? [data.imageURL] : [];
    batch.update(docSnap.ref, {
      images,
      imageURL: admin.firestore.FieldValue.delete(),
    });
    patched++;
    inBatch++;
    if (inBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();

  console.log(`\nDone. Patched: ${patched}  Already migrated: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
