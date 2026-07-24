#!/usr/bin/env node
/**
 * backfill-notification-eventid.mjs
 *
 * One-off: `NotificationDataSchema.eventId` is `z.string().nullable()` — the key
 * must be present, `null` for notifications with no associated event (the
 * builder always writes it). Some notification docs predate that and omit
 * the key, so the strict converter throws `eventId: expected string, received
 * undefined` on read. Set `eventId: null` on every notification doc missing it.
 *
 * USAGE
 *   node scripts/backfill-notification-eventid.mjs                 (dev dry run)
 *   node scripts/backfill-notification-eventid.mjs --apply         (dev writes)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-notification-eventid.mjs --env=beta --confirm --apply
 *
 * Credentials resolve via initAdminForEnv (see lib/env-credentials.mjs). Dev is
 * autonomous; beta/prod require --confirm (and the stored ADC — unset
 * GOOGLE_APPLICATION_CREDENTIALS so a dev key can't hijack the target project).
 * `--apply` still gates the actual write on every env (dry run without it).
 *
 * Idempotent: only patches docs whose `eventId` is still undefined.
 * `notifications` lives only under users/{uid}/notifications, so a plain
 * collection-group scan is unambiguous.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';
import { parseEnvConfirm } from './lib/env-confirm.mjs';
import { backfillCollection } from './lib/backfill.mjs';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

function patchFor(data) {
  return data.eventId === undefined ? { eventId: null } : null;
}

async function main() {
  console.log(`${APPLY ? 'Backfilling' : 'DRY-RUN: checking'} notifications.eventId against ${projectId}`);
  await backfillCollection(db, 'notifications', db.collectionGroup('notifications'), patchFor, { apply: APPLY });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
