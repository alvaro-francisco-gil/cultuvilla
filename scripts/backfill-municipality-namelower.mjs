#!/usr/bin/env node
/**
 * backfill-municipality-namelower.mjs
 *
 * One-off: for every municipality doc that lacks `nameLower`, derive it from
 * `name` (NFD-decompose, strip combining marks, lowercase) and patch the doc.
 *
 * USAGE
 *   node scripts/backfill-municipality-namelower.mjs                 (dev dry run)
 *   node scripts/backfill-municipality-namelower.mjs --apply         (dev writes)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-municipality-namelower.mjs --env=beta --confirm --apply
 *
 * Credentials resolve via initAdminForEnv (see lib/env-credentials.mjs). Dev is
 * autonomous; beta/prod require --confirm (and the stored ADC — unset
 * GOOGLE_APPLICATION_CREDENTIALS so a dev key can't hijack the target project).
 * `--apply` still gates the actual write on every env (dry run without it).
 *
 * Idempotent: re-runs only patch docs whose `nameLower` is still wrong/missing.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';
import { parseEnvConfirm } from './lib/env-confirm.mjs';
import { backfillCollection } from './lib/backfill.mjs';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

function searchKey(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function patchFor(data) {
  if (typeof data.name !== 'string') return null;
  const want = searchKey(data.name);
  return data.nameLower === want ? null : { nameLower: want };
}

async function main() {
  console.log(`${APPLY ? 'Backfilling' : 'DRY-RUN: checking'} municipalities.nameLower against ${projectId}`);
  await backfillCollection(db, 'municipalities', db.collection('municipalities'), patchFor, { apply: APPLY });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
