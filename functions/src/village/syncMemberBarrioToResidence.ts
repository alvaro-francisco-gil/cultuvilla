import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface ResidenceLink {
  municipalityId: string;
  barrioId: string | null;
}

/**
 * Projects an account-holder's residence barrio from their membership doc into
 * the linked person's `municipalityLinks`, so the barrio residents list
 * (`getPersonsByBarrio`, an array-contains query on persons) stays consistent
 * with the editable source of truth.
 *
 * Source of truth: municipalities/{municipalityId}/members/{userId}.barrioId
 * Read target:     persons/{personId}.municipalityLinks (the entry whose
 *   municipalityId === this municipality).
 *
 * Behaviour:
 *   - create/update → upsert {municipalityId, barrioId} into municipalityLinks
 *     (replace the matching entry, or append if absent). Joining a village makes
 *     you a resident of it (whole village when barrioId is null).
 *   - delete → remove the municipalityLinks entry for this municipality. Leaving
 *     the community drops the residence link.
 *   - barrioId that is not an *approved* barrio of this municipality (stale,
 *     foreign, or a tampered client write) is normalized to null rather than
 *     failing — the picker prevents it on the honest path.
 *
 * Account-holders only: a person is found by `userId == {userId}`. Persons
 * without an account (no membership) keep setting municipalityLinks directly.
 */
export const syncMemberBarrioToResidence = onDocumentWritten(
  { document: 'municipalities/{municipalityId}/members/{userId}', region: 'us-central1' },
  async (event) => {
    const handler = 'syncMemberBarrioToResidence';
    const { municipalityId, userId } = event.params;

    const after = event.data?.after.data();
    const isDelete = !after;

    // The person linked to this account. No person → nothing to project onto.
    const personSnap = await db
      .collection('persons')
      .where('userId', '==', userId)
      .limit(1)
      .get();
    if (personSnap.empty) {
      logger.info('No linked person; skipping residence sync', {
        handler,
        municipalityId,
        userId,
      });
      return;
    }
    const personRef = personSnap.docs[0].ref;
    const person = personSnap.docs[0].data();

    // Desired barrio for this village: validate against approved barrios.
    let desiredBarrioId: string | null = null;
    let normalized = false;
    if (!isDelete) {
      const raw = (after['barrioId'] as string | null | undefined) ?? null;
      if (raw) {
        const barrioSnap = await db
          .doc(`municipalities/${municipalityId}/barrios/${raw}`)
          .get();
        if (barrioSnap.exists && barrioSnap.get('status') === 'approved') {
          desiredBarrioId = raw;
        } else {
          normalized = true; // stale/foreign/pending → whole village
        }
      }
    }

    const current: ResidenceLink[] = Array.isArray(person['municipalityLinks'])
      ? (person['municipalityLinks'] as ResidenceLink[])
      : [];
    const others = current.filter((l) => l.municipalityId !== municipalityId);
    const next: ResidenceLink[] = isDelete
      ? others
      : [...others, { municipalityId, barrioId: desiredBarrioId }];

    // Idempotency: skip the write when the projected links are unchanged, so a
    // membership mutation that didn't touch the barrio (e.g. profileAnswers)
    // doesn't fan out a no-op person write.
    if (JSON.stringify(current) === JSON.stringify(next)) return;

    await personRef.update({ municipalityLinks: next });
    logger.info('Residence link synced from membership', {
      handler,
      municipalityId,
      userId,
      personId: personRef.id,
      action: isDelete ? 'remove' : 'upsert',
      barrioId: desiredBarrioId,
      normalized,
    });
  },
);
