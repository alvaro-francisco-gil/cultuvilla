import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { eventsCollection } from '@cultuvilla/shared/firebase/refs/admin';

const db = getFirestore();

export const completeExpiredEvents = onSchedule('every 1 hours', async () => {
  const events = await eventsCollection(db).where('status', '==', 'published').get();
  const now = new Date();

  for (const event of events.docs) {
    const data = event.data();
    const compareDate = data.endDate ?? data.startDate;
    if (compareDate < now) {
      await event.ref.update({
        status: 'completed',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
});
