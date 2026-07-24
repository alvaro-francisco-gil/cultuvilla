#!/usr/bin/env node
/**
 * backfill-entity-contributors.mjs
 *
 * Backfills the public contributor-credit arrays on places and festival posters.
 * Strict converters require both arrays on every document; existing records
 * credit their proposer when present, otherwise use empty arrays.
 *
 * USAGE
 *   node scripts/backfill-entity-contributors.mjs                 (dev dry run)
 *   node scripts/backfill-entity-contributors.mjs --apply         (dev writes)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-entity-contributors.mjs --env=beta --confirm --apply
 *
 * Credentials resolve via initAdminForEnv (see lib/env-credentials.mjs). Dev is
 * autonomous; beta/prod require --confirm (and the stored ADC — unset
 * GOOGLE_APPLICATION_CREDENTIALS so a dev key can't hijack the target project).
 * `--apply` still gates the actual write on every env (dry run without it).
 *
 * Idempotent: only patches documents missing either array.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';
import { parseEnvConfirm } from './lib/env-confirm.mjs';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');

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
    patched += 1;
    batchSize += 1;
    if (APPLY) batch.update(docSnap.ref, patch);
    if (batchSize === 400) {
      if (APPLY) await batch.commit();
      batch = db.batch();
      batchSize = 0;
    }
  }
  if (APPLY && batchSize > 0) await batch.commit();
  console.log(
    `${collectionName}: ${snap.size} docs — ${APPLY ? 'patched' : 'would patch'} ${patched}, already conformant ${snap.size - patched}`,
  );
}

async function main() {
  console.log(`${APPLY ? 'Backfilling' : 'DRY-RUN: checking'} entity contributor credits against ${projectId}`);
  await backfill('festivalPosters', await db.collection('festivalPosters').get());
  await backfill('places', await db.collectionGroup('places').get());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
