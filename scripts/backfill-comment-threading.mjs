#!/usr/bin/env node
/**
 * backfill-comment-threading.mjs
 *
 * One-off: the comment-threading feature added two REQUIRED fields to the
 * `comments/` collection — `parentCommentId` (nullable) and `replyCount`.
 * It also added `entityKind`/`entityId` (both nullable) to the
 * `users/{uid}/notifications` collection group, for the `comment_reply`
 * notification type. Existing dev docs predate these fields, so the strict
 * Zod converter now throws on read. Backfill every doc missing them with the
 * same defaults the model builders use (`parentCommentId: null`,
 * `replyCount: 0`, `entityKind: null`, `entityId: null`).
 *
 * USAGE
 *   node scripts/backfill-comment-threading.mjs                  (dev, default)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-comment-threading.mjs --env=beta --confirm
 *
 * Credentials resolve via initAdminForEnv (see lib/env-credentials.mjs). Dev is
 * autonomous; beta/prod require --confirm (and the stored ADC — unset
 * GOOGLE_APPLICATION_CREDENTIALS so a dev key can't hijack the target project).
 *
 * Idempotent: only patches docs missing the fields; re-running after a full
 * backfill patches 0 docs.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';
import { parseEnvConfirm } from './lib/env-confirm.mjs';
import { backfillCollection } from './lib/backfill.mjs';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();

function patchFor(data) {
  const patch = {};
  if (data.parentCommentId === undefined) patch.parentCommentId = null;
  if (data.replyCount === undefined) patch.replyCount = 0;
  return patch;
}

function patchForNotifications(data) {
  const patch = {};
  if (data.entityKind === undefined) patch.entityKind = null;
  if (data.entityId === undefined) patch.entityId = null;
  return patch;
}

async function main() {
  console.log(`Backfilling comment threading fields against ${projectId}\n`);
  const { patched, total } = await backfillCollection(db, 'comments', db.collection('comments'), patchFor);

  const { patched: notificationsPatched, total: notificationsTotal } = await backfillCollection(
    db,
    'notifications (collection group)',
    db.collectionGroup('notifications'),
    patchForNotifications,
  );

  console.log(`\nDone. Total patched: ${patched}/${total} comments, ${notificationsPatched}/${notificationsTotal} notifications`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
