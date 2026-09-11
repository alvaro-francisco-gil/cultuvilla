import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { buildNotificationData, wrappedId } from '@cultuvilla/shared/models';
import { blocksJustEnded } from './wrappedWindows';
import {
  municipalitiesCollection,
  municipalityMembersCollection,
  userNotificationsCollection,
  villageWrappedCollection,
  villageWrappedDoc,
} from '@cultuvilla/shared/firebase/refs/admin';
import { buildAndStoreWrapped } from './storeWrapped';

const db = getFirestore();

/** Every village admin gets told; the Wrapped is theirs to release. */
async function notifyVillageAdmins(
  database: Firestore,
  municipalityId: string,
  villageName: string,
  blockName: string,
  id: string,
): Promise<number> {
  const admins = await municipalityMembersCollection(database, municipalityId).where('role', '==', 'admin').get();
  await Promise.all(
    admins.docs.map((m) =>
      // One notification per Wrapped per admin: the id is the Wrapped's, so a
      // rebuild overwrites rather than notifying the same person twice.
      userNotificationsCollection(database, m.id)
        .doc(`wrapped_${id}`)
        .set(
          buildNotificationData({
            type: 'village_wrapped_ready',
            title: 'El resumen de las fiestas está listo',
            body: `Ya puedes publicar el resumen de ${blockName} en ${villageName}.`,
            municipalityId,
          }),
        ),
    ),
  );
  return admins.size;
}

/**
 * The Wrapped lifecycle, once an hour.
 *
 * Two independent passes, in this order:
 *  1. a block whose window just closed gets computed and its admins notified;
 *  2. a draft whose grace period expired publishes itself.
 *
 * Only villages that declared exact fiestas dates take part — that is the gate,
 * and it is why the dates are worth filling in. `autoPublishAt` is a stored
 * timestamp rather than elapsed-time arithmetic, so a missed run delays
 * publication instead of skipping it.
 */
export const runVillageWrappedLifecycle = onSchedule(
  { schedule: 'every 1 hours', timeZone: 'Europe/Madrid', memory: '1GiB', timeoutSeconds: 540 },
  async () => {
    const handler = 'runVillageWrappedLifecycle';
    const now = new Date();

    const villages = await municipalitiesCollection(db).where('communityActive', '==', true).get();
    let built = 0;
    for (const snap of villages.docs) {
      const fiestas = snap.data().community?.fiestas ?? [];
      for (const { block, year } of blocksJustEnded(fiestas, now)) {
        const id = wrappedId(snap.id, year, block.id);
        // Built once. A later recompute is an admin's explicit call, so the
        // hourly run never re-renders (or re-notifies) what already exists.
        if ((await villageWrappedDoc(db, id).get()).exists) continue;
        try {
          const result = await buildAndStoreWrapped(db, snap.id, block, year, now);
          if (!result) continue;
          built += 1;
          const notified = await notifyVillageAdmins(db, snap.id, result.data.villageName, block.name, id);
          logger.info('village wrapped offered to admins', {
            handler, municipalityId: snap.id, wrappedId: id, notified,
          });
        } catch (error) {
          // One village's bad data must not stop every other village's Wrapped.
          logger.error('village wrapped build failed', {
            handler, municipalityId: snap.id, wrappedId: id, error: String(error),
          });
        }
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
      built,
      autoPublished: due.size,
    });
  },
);
