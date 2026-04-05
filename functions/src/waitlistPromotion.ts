import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const onRegistrationDeleted = onDocumentDeleted(
  'villages/{villageId}/events/{eventId}/registrations/{regId}',
  async (event) => {
    const { villageId, eventId } = event.params;
    const deletedData = event.data?.data();

    if (!deletedData || deletedData.status !== 'confirmed') return;

    const eventSnap = await db.doc(`villages/${villageId}/events/${eventId}`).get();
    const eventData = eventSnap.data();
    if (!eventData?.maxAttendees) return;

    const waitlisted = await db
      .collection(`villages/${villageId}/events/${eventId}/registrations`)
      .where('status', '==', 'waitlisted')
      .orderBy('position', 'asc')
      .limit(1)
      .get();

    if (waitlisted.empty) return;

    const nextInLine = waitlisted.docs[0];
    const nextData = nextInLine.data();

    await nextInLine.ref.update({ status: 'confirmed' });

    await db.collection(`users/${nextData.userId}/notifications`).add({
      type: 'waitlist_promoted',
      title: '¡Plaza confirmada!',
      body: `Se ha liberado una plaza en "${eventData.title}" para ${nextData.name}`,
      eventId,
      villageId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  },
);
