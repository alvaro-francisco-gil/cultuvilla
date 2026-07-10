import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue, type DocumentReference } from 'firebase-admin/firestore';

const db = getFirestore();

function parentRef(
  entityKind: string,
  entityId: string,
  municipalityId: string,
): DocumentReference | null {
  switch (entityKind) {
    case 'event':          return db.collection('events').doc(entityId);
    case 'organization':   return db.collection('organizations').doc(entityId);
    case 'festivalPoster': return db.collection('festivalPosters').doc(entityId);
    case 'news':           return db.collection('news').doc(entityId);
    case 'place':          return db.collection('municipalities').doc(municipalityId).collection('places').doc(entityId);
    case 'barrio':         return db.collection('municipalities').doc(municipalityId).collection('barrios').doc(entityId);
    default:               return null;
  }
}

function isNotFound(err: unknown): boolean {
  const code = (err as { code?: number | string } | null)?.code;
  return code === 5 || code === 'NOT_FOUND' || code === 'not-found';
}

export const syncEntityCommentCount = onDocumentWritten(
  { document: 'comments/{commentId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() ?? null;
    const after = event.data?.after.data() ?? null;
    if (!before && !after) return;
    let delta = 0;
    if (!before && after) delta = 1;
    else if (before && !after) delta = -1;
    if (delta === 0) return; // comments are immutable (rules), so only create/delete fire
    const d = after ?? before;
    if (!d) return;
    const entityKind = d['entityKind'] as string;
    const entityId = d['entityId'] as string;
    const municipalityId = d['municipalityId'] as string;
    const ref = parentRef(entityKind, entityId, municipalityId);
    if (!ref) {
      logger.warn('unknown entityKind for comment count', {
        handler: 'syncEntityCommentCount', entityKind,
      });
      return;
    }
    try {
      await ref.update({ commentCount: FieldValue.increment(delta) });
    } catch (err) {
      if (isNotFound(err)) return; // parent deleted before trigger ran → no-op (avoid infinite retry)
      throw err;
    }
    logger.info('comment count updated', {
      handler: 'syncEntityCommentCount', entityKind, entityId, delta,
    });
  },
);

export const syncEntityReactionCounts = onDocumentWritten(
  { document: 'reactions/{reactionId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() ?? null;
    const after = event.data?.after.data() ?? null;
    if (!before && !after) return;
    const d = after ?? before;
    if (!d) return;
    const entityKind = d['entityKind'] as string;
    const entityId = d['entityId'] as string;
    const municipalityId = d['municipalityId'] as string;
    const ref = parentRef(entityKind, entityId, municipalityId);
    if (!ref) {
      logger.warn('unknown entityKind for reaction count', {
        handler: 'syncEntityReactionCounts', entityKind,
      });
      return;
    }
    try {
      if (!before && after) {
        await ref.update({ [`reactionCounts.${after['kind'] as string}`]: FieldValue.increment(1) });
      } else if (before && !after) {
        await ref.update({ [`reactionCounts.${before['kind'] as string}`]: FieldValue.increment(-1) });
      } else if (before && after) {
        const oldKind = before['kind'] as string;
        const newKind = after['kind'] as string;
        if (oldKind === newKind) return;
        await ref.update({
          [`reactionCounts.${oldKind}`]: FieldValue.increment(-1),
          [`reactionCounts.${newKind}`]: FieldValue.increment(1),
        });
      }
    } catch (err) {
      if (isNotFound(err)) return;
      throw err;
    }
    logger.info('reaction counts updated', {
      handler: 'syncEntityReactionCounts', entityKind, entityId,
    });
  },
);
