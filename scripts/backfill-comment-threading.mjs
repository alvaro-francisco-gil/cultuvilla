#!/usr/bin/env node
/**
 * Backfill the required fields the comment-threading feature added:
 * `parentCommentId` (nullable) and `replyCount` on `comments/`, and
 * `entityKind`/`entityId` (both nullable) on the `users/{uid}/notifications`
 * collection group, for the `comment_reply` notification type.
 *
 * Docs predating those fields make the strict Zod converter throw on read, so
 * this writes the same defaults the model builders use.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   node scripts/backfill-comment-threading.mjs --env=dev            (dry run)
 *   node scripts/backfill-comment-threading.mjs --env=dev --apply
 *   node scripts/backfill-comment-threading.mjs --env=beta --confirm --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'comment-threading',
  kind: 'backfill',
  description:
    'Add comments.parentCommentId/replyCount and notifications.entityKind/entityId so the strict converters can read pre-threading docs',
  // Already applied to every env before the registry existed, so it gates
  // nothing now. Authored today it would be 'pre-deploy': the converters that
  // require these fields cannot read a doc that is missing them.
  phase: 'none',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: [],
};

function patchComment(data) {
  const patch = {};
  if (data.parentCommentId === undefined) patch.parentCommentId = null;
  if (data.replyCount === undefined) patch.replyCount = 0;
  return patch;
}

function patchNotification(data) {
  const patch = {};
  if (data.entityKind === undefined) patch.entityKind = null;
  if (data.entityId === undefined) patch.entityId = null;
  return patch;
}

export async function run({ db, apply, log }) {
  log('comment threading fields');
  const comments = await backfillCollection(db, 'comments', db.collection('comments'), patchComment, { apply });
  const notifications = await backfillCollection(
    db,
    'notifications (collection group)',
    db.collectionGroup('notifications'),
    patchNotification,
    { apply },
  );
  return { comments, notifications };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
