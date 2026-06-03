import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { newsDoc } from '@cultuvilla/shared/firebase/refs/admin';

const db = getFirestore();

/**
 * Keeps reactionCounts on a news post in sync with newsReactions writes.
 *
 * NOTE: Uses FieldValue.increment(±1) without clamping. Under normal client
 * flow the counter should never go negative, but counter drift can occur on
 * partial failures (e.g. Function crash after write, before counter update).
 * A reconciliation job is deferred per spec.
 *
 * Firestore trigger snapshots are NOT converter-wrapped, so before/after
 * data() returns raw DocumentData — we use narrow casts on the primitive
 * fields we actually read.
 */
export const syncNewsReactionCounts = onDocumentWritten(
  { document: 'newsReactions/{reactionId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() ?? null;
    const after = event.data?.after.data() ?? null;

    if (!before && !after) return;

    const postId = (after?.['postId'] ?? before?.['postId']) as string | undefined;
    if (!postId) return;

    // Typed ref — .update() bypasses the converter, so dot-path increments
    // with FieldValue sentinels typecheck against UpdateData<NewsPostData>.
    const postRawRef = newsDoc(db, postId);

    // Race: the parent news post may have been deleted before this trigger
    // ran. Treat NOT_FOUND as a no-op (the post is gone, no counters to
    // maintain) and avoid throwing — otherwise Eventarc would retry the
    // trigger indefinitely.
    const isNotFound = (err: unknown): boolean => {
      const code = (err as { code?: number | string } | null)?.code;
      return code === 5 || code === 'NOT_FOUND' || code === 'not-found';
    };

    try {
      if (!before && after) {
        // Create: increment the new kind
        const kind = after['kind'] as string;
        await postRawRef.update({ [`reactionCounts.${kind}`]: FieldValue.increment(1) });
        logger.info('reaction created', { handler: 'syncNewsReactionCounts', postId, kind });
      } else if (before && !after) {
        // Delete: decrement the old kind
        const kind = before['kind'] as string;
        await postRawRef.update({ [`reactionCounts.${kind}`]: FieldValue.increment(-1) });
        logger.info('reaction deleted', { handler: 'syncNewsReactionCounts', postId, kind });
      } else if (before && after) {
        const oldKind = before['kind'] as string;
        const newKind = after['kind'] as string;
        if (oldKind === newKind) return; // no-op
        await postRawRef.update({
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
    } catch (err) {
      if (isNotFound(err)) {
        logger.warn('news post missing when updating reaction counts, skipping', {
          handler: 'syncNewsReactionCounts',
          postId,
        });
        return;
      }
      throw err;
    }
  },
);
