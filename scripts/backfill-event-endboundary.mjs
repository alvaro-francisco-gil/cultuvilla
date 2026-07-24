#!/usr/bin/env node
/**
 * backfill-event-endboundary.mjs
 *
 * One-off: for every event doc, derive `endBoundary` from `endDate ?? startDate`
 * (the same rule buildEventData / eventEndBoundary use) and patch the doc when
 * it is missing or stale. `endBoundary` is the feed's range/order key (see
 * feedService.getUpcomingFeed); the strict converter requires it, so a stale
 * event would otherwise crash any screen that reads it.
 *
 * USAGE
 *   node scripts/backfill-event-endboundary.mjs                 (dev dry run)
 *   node scripts/backfill-event-endboundary.mjs --apply         (dev writes)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-event-endboundary.mjs --env=beta --confirm --apply
 *
 * Credentials resolve via initAdminForEnv (see lib/env-credentials.mjs). Dev is
 * autonomous; beta/prod require --confirm (and the stored ADC — unset
 * GOOGLE_APPLICATION_CREDENTIALS so a dev key can't hijack the target project).
 * `--apply` still gates the actual write on every env (dry run without it).
 *
 * Idempotent: re-runs only patch docs whose `endBoundary` is missing or wrong.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';
import { parseEnvConfirm } from './lib/env-confirm.mjs';
import { backfillCollection } from './lib/backfill.mjs';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');
let skipped = 0;

function patchFor(data) {
  // startDate is a required Timestamp; skip anything malformed rather than guess.
  if (!(data.startDate instanceof admin.firestore.Timestamp)) {
    skipped++;
    return null;
  }
  const endDate = data.endDate instanceof admin.firestore.Timestamp ? data.endDate : null;
  const want = endDate ?? data.startDate;
  if (data.endBoundary instanceof admin.firestore.Timestamp && data.endBoundary.isEqual(want)) {
    return null;
  }
  return { endBoundary: want };
}

async function main() {
  console.log(`${APPLY ? 'Backfilling' : 'DRY-RUN: checking'} events.endBoundary against ${projectId}`);
  await backfillCollection(db, 'events', db.collection('events'), patchFor, { apply: APPLY });
  console.log(`  Skipped (no startDate): ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
