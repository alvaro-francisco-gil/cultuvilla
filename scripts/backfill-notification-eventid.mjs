#!/usr/bin/env node
/**
 * backfill-notification-eventid.mjs
 *
 * One-off: `NotificationDataSchema.eventId` is `z.string().nullable()` — the key
 * must be present, `null` for notifications with no associated event (the
 * builder always writes it). Some dev notification docs predate that and omit
 * the key, so the strict converter throws `eventId: expected string, received
 * undefined` on read. Set `eventId: null` on every notification doc missing it.
 *
 * USAGE
 *   node scripts/backfill-notification-eventid.mjs
 *
 * Idempotent: only patches docs whose `eventId` is still undefined.
 * `notifications` lives only under users/{uid}/notifications, so a plain
 * collection-group scan is unambiguous.
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'villa-events';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS is not set. See firebase-admin-dev skill.');
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

if (admin.app().options.projectId !== PROJECT_ID) {
  console.error(`Refusing to run against ${admin.app().options.projectId} — dev only.`);
  process.exit(1);
}

async function main() {
  const snap = await db.collectionGroup('notifications').get();
  console.log(`Scanned ${snap.size} notification docs.`);

  let patched = 0;
  let alreadyCorrect = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const doc of snap.docs) {
    if (doc.data().eventId !== undefined) {
      alreadyCorrect++;
      continue;
    }
    batch.update(doc.ref, { eventId: null });
    patched++;
    inBatch++;
    if (inBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();

  console.log('\nDone.');
  console.log(`  Already correct: ${alreadyCorrect}`);
  console.log(`  Patched:         ${patched}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
