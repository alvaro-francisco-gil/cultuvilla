import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  eventDoc,
  organizationDoc,
  festivalPosterDoc,
  newsDoc,
  municipalityPlaceDoc,
  municipalityBarrioDoc,
} from '@cultuvilla/shared/firebase/refs/admin';

const db = getFirestore();

type ApplyResult = 'applied' | 'unknown-kind' | 'not-found';

function isNotFound(err: unknown): boolean {
  const code = (err as { code?: number | string } | null)?.code;
  return code === 5 || code === 'NOT_FOUND' || code === 'not-found';
}

// Routes a field-path update to the parent entity's doc via the typed ref
// factories. The `.update(field, value, …)` field-path overload is used (not the
// data overload) so the entity converters aren't invoked for these partial
// counter writes and dot-path keys like `reactionCounts.<kind>` pass through.
// Switching and calling `.update` inside each branch keeps every ref a single
// concrete type — no union-assignment problem.
async function applyToParent(
  entityKind: string,
  entityId: string,
  municipalityId: string,
  field: string,
  value: FieldValue,
  ...more: (string | FieldValue)[]
): Promise<ApplyResult> {
  try {
    switch (entityKind) {
      case 'event':          await eventDoc(db, entityId).update(field, value, ...more); break;
      case 'organization':   await organizationDoc(db, entityId).update(field, value, ...more); break;
      case 'festivalPoster': await festivalPosterDoc(db, entityId).update(field, value, ...more); break;
      case 'news':           await newsDoc(db, entityId).update(field, value, ...more); break;
      case 'place':          await municipalityPlaceDoc(db, municipalityId, entityId).update(field, value, ...more); break;
      case 'barrio':         await municipalityBarrioDoc(db, municipalityId, entityId).update(field, value, ...more); break;
      default:               return 'unknown-kind';
    }
    return 'applied';
  } catch (err) {
    if (isNotFound(err)) return 'not-found'; // parent deleted before trigger ran → no-op (avoid infinite retry)
    throw err;
  }
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
    const result = await applyToParent(
      entityKind,
      entityId,
      municipalityId,
      'commentCount',
      FieldValue.increment(delta),
    );
    if (result === 'unknown-kind') {
      logger.warn('unknown entityKind for comment count', {
        handler: 'syncEntityCommentCount', entityKind,
      });
      return;
    }
    if (result === 'applied') {
      logger.info('comment count updated', {
        handler: 'syncEntityCommentCount', entityKind, entityId, delta,
      });
    }
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
    let result: ApplyResult;
    if (!before && after) {
      result = await applyToParent(
        entityKind, entityId, municipalityId,
        `reactionCounts.${after['kind'] as string}`, FieldValue.increment(1),
      );
    } else if (before && !after) {
      result = await applyToParent(
        entityKind, entityId, municipalityId,
        `reactionCounts.${before['kind'] as string}`, FieldValue.increment(-1),
      );
    } else if (before && after) {
      const oldKind = before['kind'] as string;
      const newKind = after['kind'] as string;
      if (oldKind === newKind) return;
      result = await applyToParent(
        entityKind, entityId, municipalityId,
        `reactionCounts.${oldKind}`, FieldValue.increment(-1),
        `reactionCounts.${newKind}`, FieldValue.increment(1),
      );
    } else {
      return;
    }
    if (result === 'unknown-kind') {
      logger.warn('unknown entityKind for reaction count', {
        handler: 'syncEntityReactionCounts', entityKind,
      });
      return;
    }
    if (result === 'applied') {
      logger.info('reaction counts updated', {
        handler: 'syncEntityReactionCounts', entityKind, entityId,
      });
    }
  },
);
