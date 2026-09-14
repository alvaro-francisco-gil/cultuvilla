import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { buildNotificationData, wrappedId } from '@cultuvilla/shared/models';
import {
  municipalitiesCollection,
  municipalityMembersCollection,
  userNotificationsCollection,
  villageWrappedCollection,
  villageWrappedDoc,
} from '@cultuvilla/shared/firebase/refs/admin';
import { wrappedReminderYear } from './wrappedWindows';

const db = getFirestore();

/** gRPC ALREADY_EXISTS — `create()` on a doc that is there. */
const ALREADY_EXISTS = 6;

/**
 * Ask every village admin to create the year's Wrapped. Returns how many were
 * newly reminded.
 *
 * `create()`, keyed by village and year: the job runs every hour for the whole
 * reminder month, and a reminder already delivered must not be delivered — or
 * pushed — again.
 */
export async function remindVillageAdmins(
  database: Firestore,
  municipalityId: string,
  villageName: string,
  year: number,
): Promise<number> {
  const admins = await municipalityMembersCollection(database, municipalityId).where('role', '==', 'admin').get();
  const results = await Promise.all(
    admins.docs.map(async (m) => {
      try {
        await userNotificationsCollection(database, m.id)
          .doc(`wrapped_reminder_${municipalityId}_${String(year)}`)
          .create(
            buildNotificationData({
              type: 'village_wrapped_reminder',
              title: `¿Creamos el resumen de Fiestas ${String(year)}?`,
              body: `Elige las fechas de las fiestas de ${villageName} y prepara el resumen para compartir.`,
              municipalityId,
            }),
          );
        return 1;
      } catch (error) {
        if ((error as { code?: unknown }).code === ALREADY_EXISTS) return 0;
        throw error;
      }
    }),
  );
  return results.reduce<number>((a, b) => a + b, 0);
}

/**
 * The Wrapped lifecycle, once an hour.
 *
 * Two independent passes:
 *  1. the month after a village's last fiestas, its admins are reminded to
 *     create the year's Wrapped — unless it already exists. The job cannot
 *     build it itself: a fiesta block only knows its month, and the days are
 *     the admin's to pick;
 *  2. a draft whose grace period expired publishes itself.
 *
 * `autoPublishAt` is a stored timestamp rather than elapsed-time arithmetic, so
 * a missed run delays publication instead of skipping it.
 */
export const runVillageWrappedLifecycle = onSchedule(
  { schedule: 'every 1 hours', timeZone: 'Europe/Madrid', timeoutSeconds: 540 },
  async () => {
    const handler = 'runVillageWrappedLifecycle';
    const now = new Date();

    const villages = await municipalitiesCollection(db).where('communityActive', '==', true).get();
    let reminded = 0;
    for (const snap of villages.docs) {
      const year = wrappedReminderYear(snap.data().community?.fiestas ?? [], now);
      if (year === null) continue;
      try {
        if ((await villageWrappedDoc(db, wrappedId(snap.id, year)).get()).exists) continue;
        reminded += await remindVillageAdmins(db, snap.id, snap.data().name, year);
      } catch (error) {
        // One village's bad data must not stop every other village's reminder.
        logger.error('village wrapped reminder failed', { handler, municipalityId: snap.id, year, error: String(error) });
      }
    }

    const due = await villageWrappedCollection(db)
      .where('status', '==', 'draft')
      .where('autoPublishAt', '<=', now)
      .get();
    await Promise.all(
      due.docs.map((d) => d.ref.set({ ...d.data(), status: 'published', autoPublishAt: null })),
    );

    logger.info('village wrapped lifecycle ran', {
      handler,
      villagesScanned: villages.size,
      reminded,
      autoPublished: due.size,
    });
  },
);
