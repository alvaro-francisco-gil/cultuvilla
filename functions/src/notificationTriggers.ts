import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { eventRegistrationsCollection } from '@cultuvilla/shared/firebase/refs/admin';

const db = getFirestore();

/**
 * Watches top-level /events/{eventId} docs and notifies all registrants on
 * cancellation or significant edits.
 *
 * Note: Firestore trigger snapshots are NOT converter-wrapped, so
 * `before.data()` / `after.data()` return raw `DocumentData` containing
 * Firestore Timestamps and GeoPoints — NOT the normalized EventData shape
 * the read-side ref factories produce. We deliberately use raw access with
 * narrow casts here; `EventDataSchema.safeParse` would fail because the
 * schema expects Date and {lat,lng}.
 */
export const onEventUpdated = onDocumentUpdated(
  'events/{eventId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const { eventId } = event.params;

    if (!before || !after) return;

    const afterTitle = after['title'] as string | undefined;
    const beforeStatus = before['status'] as string | undefined;
    const afterStatus = after['status'] as string | undefined;
    const municipalityId = (after['municipalityId'] as string | undefined) ?? null;

    if (beforeStatus !== 'cancelled' && afterStatus === 'cancelled') {
      const regs = await eventRegistrationsCollection(db, eventId).get();
      const userIds = new Set(regs.docs.map((r) => r.data().userId));
      const batch = db.batch();
      for (const userId of userIds) {
        const ref = db.collection(`users/${userId}/notifications`).doc();
        batch.set(ref, {
          type: 'event_cancelled',
          title: 'Evento cancelado',
          body: `El evento "${afterTitle ?? ''}" ha sido cancelado`,
          eventId,
          municipalityId,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    if (
      afterStatus === 'published' && beforeStatus === 'published' &&
      (
        before['title'] !== after['title'] ||
        // startDate is a Firestore Timestamp on the raw snapshot; JSON.stringify
        // serializes to {seconds,nanoseconds} which is comparable shape-wise.
        JSON.stringify(before['startDate']) !== JSON.stringify(after['startDate']) ||
        JSON.stringify(before['location']) !== JSON.stringify(after['location'])
      )
    ) {
      const regs = await eventRegistrationsCollection(db, eventId).get();
      const userIds = new Set(regs.docs.map((r) => r.data().userId));
      const batch = db.batch();
      for (const userId of userIds) {
        const ref = db.collection(`users/${userId}/notifications`).doc();
        batch.set(ref, {
          type: 'event_updated',
          title: 'Evento actualizado',
          body: `El evento "${afterTitle ?? ''}" ha sido actualizado`,
          eventId,
          municipalityId,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  },
);
