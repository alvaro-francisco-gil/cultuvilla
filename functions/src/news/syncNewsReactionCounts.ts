import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

/**
 * Keeps reactionCounts on a news post in sync with newsReactions writes.
 *
 * NOTE: Uses FieldValue.increment(±1) without clamping. Under normal client
 * flow the counter should never go negative, but counter drift can occur on
 * partial failures (e.g. Function crash after write, before counter update).
 * A reconciliation job is deferred per spec.
 */
export const syncNewsReactionCounts = onDocumentWritten(
  { document: 'newsReactions/{reactionId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() ?? null;
    const after = event.data?.after.data() ?? null;

    if (!before && !after) return;

    const postId = (after?.['postId'] ?? before?.['postId']) as string | undefined;
    if (!postId) return;

    const postRef = db.doc(`news/${postId}`);

    if (!before && after) {
      // Create: increment the new kind
      const kind = after['kind'] as string;
      await postRef.update({ [`reactionCounts.${kind}`]: FieldValue.increment(1) });
      logger.info('reaction created', { handler: 'syncNewsReactionCounts', postId, kind });
    } else if (before && !after) {
      // Delete: decrement the old kind
      const kind = before['kind'] as string;
      await postRef.update({ [`reactionCounts.${kind}`]: FieldValue.increment(-1) });
      logger.info('reaction deleted', { handler: 'syncNewsReactionCounts', postId, kind });
    } else if (before && after) {
      const oldKind = before['kind'] as string;
      const newKind = after['kind'] as string;
      if (oldKind === newKind) return; // no-op
      await postRef.update({
        [`reactionCounts.${oldKind}`]: FieldValue.increment(-1),
        [`reactionCounts.${newKind}`]: FieldValue.increment(1),
      });
      logger.info('reaction kind changed', {
        handler: 'syncNewsReactionCounts',
        postId,
        oldKind,
        newKind,
      });
    }
  },
);
