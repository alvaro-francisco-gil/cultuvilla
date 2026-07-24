#!/usr/bin/env node
/**
 * backfill-entity-comment-counts.mjs
 *
 * One-off: the entity-comments feature added a REQUIRED `commentCount` field
 * to the 5 comment-capable entities (event, organization, festivalPoster,
 * place, barrio). Existing dev docs predate that field, so the strict Zod
 * converter now throws on read. Backfill every doc missing the field with the
 * same zero default the model factories use (`commentCount: 0`).
 *
 * Collections:
 *   - top-level: events, organizations, festivalPosters
 *   - nested: for every municipalities/{id}, its places and barrios subcollections
 *
 * `news` already has this field (NewsPostDataModel) — not touched here.
 *
 * USAGE
 *   node scripts/backfill-entity-comment-counts.mjs              (dev, default)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-entity-comment-counts.mjs --env=beta --confirm
 *
 * Credentials resolve via initAdminForEnv (see lib/env-credentials.mjs). Dev is
 * autonomous; beta/prod require --confirm (and the stored ADC — unset
 * GOOGLE_APPLICATION_CREDENTIALS so a dev key can't hijack the target project).
 *
 * Idempotent: only patches docs where `commentCount` is missing; re-running
 * after a full backfill patches 0 docs.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';
import { parseEnvConfirm } from './lib/env-confirm.mjs';
import { backfillCollection } from './lib/backfill.mjs';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();

function patchFor(data) {
  const patch = {};
  if (data.commentCount === undefined) patch.commentCount = 0;
  return patch;
}

async function main() {
  console.log(`Backfilling commentCount against ${projectId}\n`);

  let totalPatched = 0;

  for (const name of ['events', 'organizations', 'festivalPosters']) {
    const { patched } = await backfillCollection(db, name, db.collection(name), patchFor);
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
      db,
      `municipalities/${muniDoc.id}/places`,
      muniDoc.ref.collection('places'),
      patchFor,
    );
    placesTotal += places.total;
    placesPatched += places.patched;

    const barrios = await backfillCollection(
      db,
      `municipalities/${muniDoc.id}/barrios`,
      muniDoc.ref.collection('barrios'),
      patchFor,
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
