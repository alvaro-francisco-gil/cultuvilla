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
 *   node scripts/backfill-municipality-mapzoom-escudo.mjs                 (dev dry run)
 *   node scripts/backfill-municipality-mapzoom-escudo.mjs --apply         (dev writes)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-municipality-mapzoom-escudo.mjs --env=beta --confirm --apply
 *
 * Credentials resolve via initAdminForEnv (see lib/env-credentials.mjs). Dev is
 * autonomous; beta/prod require --confirm (and the stored ADC — unset
 * GOOGLE_APPLICATION_CREDENTIALS so a dev key can't hijack the target project).
 * `--apply` still gates the actual write on every env (dry run without it).
 *
 * Idempotent: only patches docs still missing a key.
 */

import { initAdminForEnv } from './lib/env-credentials.mjs';
import { parseEnvConfirm } from './lib/env-confirm.mjs';
import { backfillCollection } from './lib/backfill.mjs';
import admin from 'firebase-admin';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

function patchFor(data) {
  const patch = {};
  if (!('mapZoom' in data)) patch.mapZoom = null;
  if (!('escudoManualUrl' in data)) patch.escudoManualUrl = null;
  return patch;
}

async function main() {
  console.log(`${APPLY ? 'Backfilling' : 'DRY-RUN: checking'} municipalities.mapZoom/escudoManualUrl against ${projectId}`);
  await backfillCollection(db, 'municipalities', db.collection('municipalities'), patchFor, { apply: APPLY });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
