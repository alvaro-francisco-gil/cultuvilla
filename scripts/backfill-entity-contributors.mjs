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
import { backfillCollection } from './lib/backfill.mjs';

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

async function main() {
  console.log(`${APPLY ? 'Backfilling' : 'DRY-RUN: checking'} entity contributor credits against ${projectId}`);
  await backfillCollection(db, 'festivalPosters', db.collection('festivalPosters'), missingContributorPatch, { apply: APPLY });
  await backfillCollection(db, 'places', db.collectionGroup('places'), missingContributorPatch, { apply: APPLY });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
