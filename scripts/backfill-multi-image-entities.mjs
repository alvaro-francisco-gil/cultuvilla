#!/usr/bin/env node
/**
 * backfill-multi-image-entities.mjs
 *
 * One-off: migrate dev docs for organizations/places/barrios from the scalar
 * `imageURL` to the ordered `images: string[]` array (the same convention
 * already adopted by festivalPoster — see backfill-festivalPoster-images.mjs).
 * For each doc that still has `imageURL`, set `images: [imageURL]` (or `[]`
 * if null) and delete `imageURL` in the same update.
 *
 * Covers:
 *   - organizations/{orgId}                          (top-level)
 *   - municipalities/{id}/places/{placeId}            (per-municipality subcollection)
 *   - municipalities/{id}/barrios/{barrioId}          (per-municipality subcollection)
 *
 * USAGE
 *   node scripts/backfill-multi-image-entities.mjs             (dev, default)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-multi-image-entities.mjs --env=beta --confirm
 *
 * Credentials resolve via initAdminForEnv (see lib/env-credentials.mjs). Dev is
 * autonomous; beta/prod require --confirm (and the stored ADC — unset
 * GOOGLE_APPLICATION_CREDENTIALS so a dev key can't hijack the target project).
 *
 * Idempotent: docs already migrated (no `imageURL` field) are skipped.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';
import { parseEnvConfirm } from './lib/env-confirm.mjs';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();

/** Migrate every doc in `snap` via batched updates. Returns { patched, skipped }. */
async function migrateDocs(snap) {
  let patched = 0;
  let skipped = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const docSnap of snap) {
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

  return { patched, skipped };
}

async function main() {
  console.log(`Backfilling org/place/barrio images against ${projectId}`);

  const orgsSnap = await db.collection('organizations').get();
  const orgResult = await migrateDocs(orgsSnap.docs);
  console.log(
    `organizations: patched ${orgResult.patched}, already migrated ${orgResult.skipped} (of ${orgsSnap.size})`,
  );

  const municipalitiesSnap = await db.collection('municipalities').get();
  let placesPatched = 0;
  let placesSkipped = 0;
  let placesTotal = 0;
  let barriosPatched = 0;
  let barriosSkipped = 0;
  let barriosTotal = 0;

  for (const muniDoc of municipalitiesSnap.docs) {
    const placesSnap = await muniDoc.ref.collection('places').get();
    const placesResult = await migrateDocs(placesSnap.docs);
    placesPatched += placesResult.patched;
    placesSkipped += placesResult.skipped;
    placesTotal += placesSnap.size;

    const barriosSnap = await muniDoc.ref.collection('barrios').get();
    const barriosResult = await migrateDocs(barriosSnap.docs);
    barriosPatched += barriosResult.patched;
    barriosSkipped += barriosResult.skipped;
    barriosTotal += barriosSnap.size;
  }

  console.log(
    `places: patched ${placesPatched}, already migrated ${placesSkipped} (of ${placesTotal}, across ${municipalitiesSnap.size} municipalities)`,
  );
  console.log(
    `barrios: patched ${barriosPatched}, already migrated ${barriosSkipped} (of ${barriosTotal}, across ${municipalitiesSnap.size} municipalities)`,
  );

  console.log(
    `\nDone. Total patched: ${orgResult.patched + placesPatched + barriosPatched}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
