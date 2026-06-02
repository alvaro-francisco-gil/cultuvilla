import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();

/**
 * Keeps commentCount on a news post in sync with newsComments writes.
 * Only visible (hidden=false) comments contribute to the count.
 *
 * NOTE: Uses FieldValue.increment(±1) without clamping. Counter drift on
 * partial failures is acceptable per spec; a reconciliation job is deferred.
 *
 * Firestore trigger snapshots are NOT converter-wrapped, so before/after
 * data() returns raw DocumentData — we use narrow casts on the primitive
 * fields we actually read.
 */
export const syncNewsCommentCount = onDocumentWritten(
  { document: 'newsComments/{commentId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() ?? null;
    const after = event.data?.after.data() ?? null;

    if (!before && !after) return;

    const postId = (after?.['postId'] ?? before?.['postId']) as string | undefined;
    if (!postId) return;

    const wasVisible = before ? !(before['hidden'] as boolean) : false;
    const isVisible = after ? !(after['hidden'] as boolean) : false;

    let delta = 0;
    if (!before && after) {
      // Create
      delta = isVisible ? 1 : 0;
    } else if (before && !after) {
      // Delete
      delta = wasVisible ? -1 : 0;
    } else {
      // Update: check hidden flip
      if (wasVisible && !isVisible) delta = -1;
      else if (!wasVisible && isVisible) delta = 1;
    }

    if (delta === 0) return;

    // Raw doc ref: partial update with FieldValue sentinel bypasses converter.
    await db.doc(`news/${postId}`).update({ commentCount: FieldValue.increment(delta) });
    logger.info('comment count updated', {
      handler: 'syncNewsCommentCount',
      postId,
      delta,
    });
  },
);
