import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { eventsCollection } from '@cultuvilla/shared/firebase/refs/admin';
import { isStartDayOver } from '@cultuvilla/shared/models';

function toDate(value: unknown): Date {
  return (value as { toDate?: () => Date }).toDate?.() ?? (value as Date);
}

const db = getFirestore();

export const completeExpiredEvents = onSchedule('every 1 hours', async () => {
  const events = await eventsCollection(db).where('status', '==', 'published').get();
  const now = new Date();

  for (const event of events.docs) {
    const data = event.data();
    // Multi-day events stay live until their endDate's Madrid day is over;
    // single-day events (endDate null) fall back to startDate — same as before.
    const boundary = toDate(data.endDate ?? data.startDate);
    if (isStartDayOver(boundary, now)) {
      await event.ref.update({
        status: 'completed',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
});
