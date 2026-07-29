#!/usr/bin/env node
/**
 * Backfills `isPublic` on `persons/{id}` and its projection on
 * `municipalityPeople/{id}`.
 *
 * Both schemas now require the flag (strict Zod converter), so a doc written
 * before it existed crashes any screen that reads it. Existing people are all
 * public — that was the only behaviour available — so the backfill value is
 * `true` everywhere, matching `buildPersonData`'s default.
 *
 * Dev only. Re-running is safe: only docs missing the field are patched.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';

const { projectId } = initAdminForEnv('dev');
if (projectId !== 'villa-events') {
  throw new Error(`Refusing to backfill ${projectId}; this script is dev only.`);
}

const db = admin.firestore();

async function backfillCollection(name) {
  const snap = await db.collection(name).get();
  let patched = 0;
  let batch = db.batch();
  let batchSize = 0;

  for (const docSnap of snap.docs) {
    if (typeof docSnap.data().isPublic === 'boolean') continue;
    batch.update(docSnap.ref, { isPublic: true });
    patched += 1;
    batchSize += 1;
    if (batchSize === 400) {
      await batch.commit();
      batch = db.batch();
      batchSize = 0;
    }
  }
  if (batchSize > 0) await batch.commit();
  console.log(`${name}: ${snap.size} docs — patched ${patched}, already conformant ${snap.size - patched}`);
}

async function main() {
  console.log(`Backfilling person visibility against ${projectId}`);
  await backfillCollection('persons');
  await backfillCollection('municipalityPeople');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
