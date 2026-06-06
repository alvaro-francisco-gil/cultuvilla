import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import {
  eventDoc,
  eventRegistrationsCollection,
  userNotificationsCollection,
} from '@cultuvilla/shared/firebase/refs/admin';
import { buildNotificationData } from '@cultuvilla/shared/models';

const db = getFirestore();

/**
 * Promotes the next waitlisted registration when a confirmed one is deleted,
 * and keeps `events/{eventId}.confirmedCount` / `.totalCount` in sync.
 * Watches top-level /events/{eventId}/registrations/{regId}.
 */
export const onRegistrationDeleted = onDocumentDeleted(
  'events/{eventId}/registrations/{regId}',
  async (event) => {
    const { eventId } = event.params;
    // The trigger framework hands us a raw DocumentSnapshot (no converter),
    // so the values here are still Firestore Timestamps — we only need
    // `status`, which is a primitive, so a narrow cast is sufficient.
    const rawDeleted = event.data?.data();
    if (!rawDeleted) return;
    const deletedStatus = (rawDeleted as { status?: string }).status;

    const eventRef = eventDoc(db, eventId);
    const regsCol = eventRegistrationsCollection(db, eventId);

    // eventSnap.data() comes through the converter: typed EventData.
    const eventSnap = await eventRef.get();
    const eventData = eventSnap.data();
    if (!eventData) return;

    let promoted = false;
    if (deletedStatus === 'confirmed' && eventData.maxAttendees) {
      const waitlisted = await regsCol
        .where('status', '==', 'waitlisted')
        .orderBy('position', 'asc')
        .limit(1)
        .get();

      if (!waitlisted.empty) {
        const nextInLine = waitlisted.docs[0];
        // Converter-wrapped: typed RegistrationData.
        const nextData = nextInLine.data();
        // update() bypasses the converter, partial shape is accepted.
        await nextInLine.ref.update({ status: 'confirmed' });
        promoted = true;

        // Typed converter ref — .add() marshals through the schema, so
        // createdAt is a plain Date (sentinels would be rejected).
        await userNotificationsCollection(db, nextData.userId).add(
          buildNotificationData({
            type: 'waitlist_promoted',
            title: '¡Plaza confirmada!',
            body: `Se ha liberado una plaza en "${eventData.title}" para ${nextData.name}`,
            eventId,
            municipalityId: eventData.municipalityId,
          }),
        );
      }
    }

    // Recompute counts from authoritative state. Cheaper than tracking deltas
    // through every branch and self-heals legacy events that never had
    // counters written.
    const [confirmedSnap, totalSnap] = await Promise.all([
      regsCol.where('status', '==', 'confirmed').count().get(),
      regsCol.count().get(),
    ]);
    await eventRef.update({
      confirmedCount: confirmedSnap.data().count,
      totalCount: totalSnap.data().count,
    });

    logger.info('Registration deleted handled', {
      handler: 'onRegistrationDeleted',
      eventId,
      deletedStatus,
      promoted,
      confirmedCount: confirmedSnap.data().count,
      totalCount: totalSnap.data().count,
    });
  },
);
