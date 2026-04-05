import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const onEventUpdated = onDocumentUpdated(
  'villages/{villageId}/events/{eventId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const { villageId, eventId } = event.params;

    if (!before || !after) return;

    if (before.status !== 'cancelled' && after.status === 'cancelled') {
      const regs = await db.collection(`villages/${villageId}/events/${eventId}/registrations`).get();
      const userIds = new Set(regs.docs.map((r) => r.data().userId));
      const batch = db.batch();
      for (const userId of userIds) {
        const ref = db.collection(`users/${userId}/notifications`).doc();
        batch.set(ref, {
          type: 'event_cancelled',
          title: 'Evento cancelado',
          body: `El evento "${after.title}" ha sido cancelado`,
          eventId, villageId, read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    if (
      after.status === 'published' && before.status === 'published' &&
      (before.title !== after.title || before.startDate !== after.startDate || JSON.stringify(before.location) !== JSON.stringify(after.location))
    ) {
      const regs = await db.collection(`villages/${villageId}/events/${eventId}/registrations`).get();
      const userIds = new Set(regs.docs.map((r) => r.data().userId));
      const batch = db.batch();
      for (const userId of userIds) {
        const ref = db.collection(`users/${userId}/notifications`).doc();
        batch.set(ref, {
          type: 'event_updated',
          title: 'Evento actualizado',
          body: `El evento "${after.title}" ha sido actualizado`,
          eventId, villageId, read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  },
);
