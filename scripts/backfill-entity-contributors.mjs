#!/usr/bin/env node
/**
 * Backfills the public contributor-credit arrays on places and festival posters.
 *
 * Dev only: strict converters require both arrays on every document. Existing
 * records credit their proposer when present, otherwise use empty arrays.
 * Re-running is safe: only missing fields are patched.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';

const { projectId } = initAdminForEnv('dev');
if (projectId !== 'villa-events') {
  throw new Error(`Refusing to backfill ${projectId}; this script is dev only.`);
}

const db = admin.firestore();

function missingContributorPatch(data) {
  const patch = {};
  const proposer = typeof data.proposedBy === 'string' ? [data.proposedBy] : [];
  if (!Array.isArray(data.contributorUserIds)) patch.contributorUserIds = proposer;
  if (!Array.isArray(data.contributorOrgIds)) patch.contributorOrgIds = [];
  return patch;
}

async function backfill(collectionName, snap) {
  let patched = 0;
  let batch = db.batch();
  let batchSize = 0;

  for (const docSnap of snap.docs) {
    const patch = missingContributorPatch(docSnap.data());
    if (Object.keys(patch).length === 0) continue;
    batch.update(docSnap.ref, patch);
    patched += 1;
    batchSize += 1;
    if (batchSize === 400) {
      await batch.commit();
      batch = db.batch();
      batchSize = 0;
    }
  }
  if (batchSize > 0) await batch.commit();
  console.log(`${collectionName}: ${snap.size} docs — patched ${patched}, already conformant ${snap.size - patched}`);
}

async function main() {
  console.log(`Backfilling entity contributor credits against ${projectId}`);
  await backfill('festivalPosters', await db.collection('festivalPosters').get());
  await backfill('places', await db.collectionGroup('places').get());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
