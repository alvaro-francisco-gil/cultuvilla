#!/usr/bin/env node
/**
 * backfill-place-burial-count.mjs
 *
 * One-off: place cards now read `burialCount` directly from
 * municipalities/{mid}/places/{pid}. Recompute every place's count from
 * persons/{personId}.burialPlace so existing cemeteries show the people
 * already added there and strict converters accept old place docs.
 *
 * USAGE
 *   node scripts/backfill-place-burial-count.mjs                 (dev, default)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-place-burial-count.mjs --env=beta --confirm
 *
 * Idempotent: sets each place to the computed count only when it differs or is
 * missing. Non-cemetery places are kept at 0.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';
import { parseEnvConfirm } from './lib/env-confirm.mjs';
import { backfillCollection } from './lib/backfill.mjs';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();

function countKey(municipalityId, placeId) {
  return `${municipalityId}/${placeId}`;
}

async function computeBurialCounts() {
  const counts = new Map();
  const snap = await db.collection('persons').get();
  for (const docSnap of snap.docs) {
    const place = docSnap.data().burialPlace;
    if (!place || typeof place.municipalityId !== 'string' || typeof place.placeId !== 'string') {
      continue;
    }
    const key = countKey(place.municipalityId, place.placeId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return { counts, personTotal: snap.size };
}

async function main() {
  console.log(`Backfilling place burialCount against ${projectId}\n`);

  const { counts, personTotal } = await computeBurialCounts();
  console.log(`  persons: ${personTotal} docs — ${counts.size} cemetery refs with burials`);

  await backfillCollection(db, 'places', db.collectionGroup('places'), (data, docSnap) => {
    const municipalityDoc = docSnap.ref.parent.parent;
    if (!municipalityDoc) return null;
    const want = data.kind === 'cemetery' ? (counts.get(countKey(municipalityDoc.id, docSnap.id)) ?? 0) : 0;
    return data.burialCount === want ? null : { burialCount: want };
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
