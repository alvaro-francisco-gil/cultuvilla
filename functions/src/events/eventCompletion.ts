import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const completeExpiredEvents = onSchedule('every 1 hours', async () => {
  const villages = await db.collection('villages').get();

  for (const village of villages.docs) {
    const events = await db
      .collection(`villages/${village.id}/events`)
      .where('status', '==', 'published')
      .get();

    for (const event of events.docs) {
      // Legacy un-migrated path (villages/{id}/events). Treat data() as the
      // narrow shape we read here; full migration to typed refs is tracked
      // separately.
      const data = event.data() as {
        startDate: admin.firestore.Timestamp;
        endDate?: admin.firestore.Timestamp;
      };
      const compareDate = data.endDate ?? data.startDate;
      if (compareDate.toDate() < new Date()) {
        await event.ref.update({ status: 'completed', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
  }
});
