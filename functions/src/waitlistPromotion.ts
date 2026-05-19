import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Promotes the next waitlisted registration when a confirmed one is deleted,
 * and keeps `events/{eventId}.confirmedCount` / `.totalCount` in sync.
 * Watches top-level /events/{eventId}/registrations/{regId}.
 */
export const onRegistrationDeleted = onDocumentDeleted(
  'events/{eventId}/registrations/{regId}',
  async (event) => {
    const { eventId } = event.params;
    const deletedData = event.data?.data();
    if (!deletedData) return;

    const eventRef = db.doc(`events/${eventId}`);
    const regsCol = db.collection(`events/${eventId}/registrations`);

    const eventSnap = await eventRef.get();
    const eventData = eventSnap.data();
    if (!eventData) return;

    let promoted = false;
    if (deletedData.status === 'confirmed' && eventData.maxAttendees) {
      const waitlisted = await regsCol
        .where('status', '==', 'waitlisted')
        .orderBy('position', 'asc')
        .limit(1)
        .get();

      if (!waitlisted.empty) {
        const nextInLine = waitlisted.docs[0];
        const nextData = nextInLine.data();
        await nextInLine.ref.update({ status: 'confirmed' });
        promoted = true;

        await db.collection(`users/${nextData.userId}/notifications`).add({
          type: 'waitlist_promoted',
          title: '¡Plaza confirmada!',
          body: `Se ha liberado una plaza en "${eventData.title}" para ${nextData.name}`,
          eventId,
          municipalityId: (eventData.municipalityId as string | undefined) ?? null,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
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
      deletedStatus: deletedData.status,
      promoted,
      confirmedCount: confirmedSnap.data().count,
      totalCount: totalSnap.data().count,
    });
  },
);
