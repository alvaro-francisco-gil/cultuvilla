import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Watches top-level /events/{eventId} docs and notifies all registrants on
 * cancellation or significant edits.
 */
export const onEventUpdated = onDocumentUpdated(
  'events/{eventId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const { eventId } = event.params;

    if (!before || !after) return;

    const municipalityId = (after.municipalityId as string | undefined) ?? null;

    if (before.status !== 'cancelled' && after.status === 'cancelled') {
      const regs = await db.collection(`events/${eventId}/registrations`).get();
      const userIds = new Set(regs.docs.map((r) => r.data().userId));
      const batch = db.batch();
      for (const userId of userIds) {
        const ref = db.collection(`users/${userId}/notifications`).doc();
        batch.set(ref, {
          type: 'event_cancelled',
          title: 'Evento cancelado',
          body: `El evento "${after.title}" ha sido cancelado`,
          eventId,
          municipalityId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    if (
      after.status === 'published' && before.status === 'published' &&
      (before.title !== after.title || before.startDate !== after.startDate || JSON.stringify(before.location) !== JSON.stringify(after.location))
    ) {
      const regs = await db.collection(`events/${eventId}/registrations`).get();
      const userIds = new Set(regs.docs.map((r) => r.data().userId));
      const batch = db.batch();
      for (const userId of userIds) {
        const ref = db.collection(`users/${userId}/notifications`).doc();
        batch.set(ref, {
          type: 'event_updated',
          title: 'Evento actualizado',
          body: `El evento "${after.title}" ha sido actualizado`,
          eventId,
          municipalityId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  },
);
