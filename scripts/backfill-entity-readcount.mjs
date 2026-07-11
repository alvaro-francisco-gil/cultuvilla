#!/usr/bin/env node
/**
 * backfill-entity-readcount.mjs
 *
 * One-off: the reactions removal added a REQUIRED `readCount` field to every
 * entity kind (event, festivalPoster, organization, place, barrio, news) and
 * dropped the old `reactionCounts` field. Existing dev docs predate
 * `readCount` and may still carry `reactionCounts`, so the strict Zod
 * converter now throws on read. Backfill every doc missing `readCount` with
 * the same zero default the model factories use (`readCount: 0`), and strip
 * any leftover `reactionCounts` field.
 *
 * Collections:
 *   - top-level: events, festivalPosters, news, organizations
 *   - nested: for every municipalities/{id}, its places and barrios subcollections
 *
 * USAGE
 *   node scripts/backfill-entity-readcount.mjs
 *
 * Idempotent: only patches docs missing `readCount` or still carrying
 * `reactionCounts`; re-running after a full backfill patches 0 docs.
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

function needsPatch(data) {
  return data.readCount === undefined || data.reactionCounts !== undefined;
}

function patchFor(data) {
  const patch = {};
  if (data.readCount === undefined) patch.readCount = 0;
  if (data.reactionCounts !== undefined) patch.reactionCounts = admin.firestore.FieldValue.delete();
  return patch;
}

/** Backfill a flat collection of docs missing `readCount` / still carrying `reactionCounts`. */
async function backfillCollection(label, collectionRef) {
  const snap = await collectionRef.get();
  let patched = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (!needsPatch(data)) continue;
    batch.update(docSnap.ref, patchFor(data));
    patched++;
    inBatch++;
    if (inBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();

  console.log(`  ${label}: ${snap.size} docs — patched ${patched}, already conformant ${snap.size - patched}`);
  return { total: snap.size, patched };
}

async function main() {
  console.log(`Backfilling readCount / dropping reactionCounts against ${PROJECT_ID}\n`);

  let totalPatched = 0;

  for (const name of ['events', 'festivalPosters', 'news', 'organizations']) {
    const { patched } = await backfillCollection(name, db.collection(name));
    totalPatched += patched;
  }

  const municipalitiesSnap = await db.collection('municipalities').get();
  console.log(`  municipalities: ${municipalitiesSnap.size} docs (walking places + barrios subcollections)`);

  let placesTotal = 0;
  let placesPatched = 0;
  let barriosTotal = 0;
  let barriosPatched = 0;

  for (const muniDoc of municipalitiesSnap.docs) {
    const places = await backfillCollection(
      `municipalities/${muniDoc.id}/places`,
      muniDoc.ref.collection('places'),
    );
    placesTotal += places.total;
    placesPatched += places.patched;

    const barrios = await backfillCollection(
      `municipalities/${muniDoc.id}/barrios`,
      muniDoc.ref.collection('barrios'),
    );
    barriosTotal += barrios.total;
    barriosPatched += barrios.patched;
  }

  totalPatched += placesPatched + barriosPatched;

  console.log(`\nDone.`);
  console.log(`  places: ${placesTotal} docs — patched ${placesPatched}`);
  console.log(`  barrios: ${barriosTotal} docs — patched ${barriosPatched}`);
  console.log(`  Total patched: ${totalPatched}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
