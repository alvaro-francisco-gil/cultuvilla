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
import { backfillCollection, activeMunicipalityDocs } from './lib/backfill.mjs';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();

function patchFor(data) {
  if (!('imageURL' in data)) return null; // already migrated
  const images = typeof data.imageURL === 'string' ? [data.imageURL] : [];
  return { images, imageURL: admin.firestore.FieldValue.delete() };
}

async function main() {
  console.log(`Backfilling org/place/barrio images against ${projectId}`);

  const orgResult = await backfillCollection(db, 'organizations', db.collection('organizations'), patchFor);

  const municipalitiesSnap = await db.collection('municipalities').get();
  const activeMunicipalities = activeMunicipalityDocs(municipalitiesSnap);
  let placesPatched = 0;
  let placesTotal = 0;
  let barriosPatched = 0;
  let barriosTotal = 0;

  for (const muniDoc of activeMunicipalities) {
    const places = await backfillCollection(
      db,
      `municipalities/${muniDoc.id}/places`,
      muniDoc.ref.collection('places'),
      patchFor,
    );
    placesPatched += places.patched;
    placesTotal += places.total;

    const barrios = await backfillCollection(
      db,
      `municipalities/${muniDoc.id}/barrios`,
      muniDoc.ref.collection('barrios'),
      patchFor,
    );
    barriosPatched += barrios.patched;
    barriosTotal += barrios.total;
  }

  console.log(
    `places: patched ${placesPatched} (of ${placesTotal}, across ${activeMunicipalities.length} active of ${municipalitiesSnap.size} municipalities)`,
  );
  console.log(
    `barrios: patched ${barriosPatched} (of ${barriosTotal}, across ${activeMunicipalities.length} active of ${municipalitiesSnap.size} municipalities)`,
  );

  console.log(`\nDone. Total patched: ${orgResult.patched + placesPatched + barriosPatched}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
