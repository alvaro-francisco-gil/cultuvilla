#!/usr/bin/env node
/**
 * backfill-municipality-mapzoom-escudo.mjs
 *
 * One-off: `mapZoom` and `escudoManualUrl` became required (nullable) fields on
 * MunicipalityData. INE-seeded docs created before that lack the keys, so the
 * strict converter throws on read. Patch every municipality missing either key
 * with `null` (the value the model builder defaults to).
 *
 * USAGE
 *   GOOGLE_APPLICATION_CREDENTIALS=... node scripts/backfill-municipality-mapzoom-escudo.mjs
 *
 * Idempotent: only patches docs still missing a key.
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
  const snap = await db.collection('municipalities').get();
  console.log(`Loaded ${snap.size} municipality docs.`);

  let needsPatch = 0;
  let alreadyCorrect = 0;
  let batch = db.batch();
  let inBatch = 0;
  let committed = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const patch = {};
    if (!('mapZoom' in data)) patch.mapZoom = null;
    if (!('escudoManualUrl' in data)) patch.escudoManualUrl = null;
    if (Object.keys(patch).length === 0) {
      alreadyCorrect++;
      continue;
    }
    batch.update(docSnap.ref, patch);
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
