#!/usr/bin/env node
/**
 * backfill-organizer-id.mjs
 *
 * One-off: rename the village organizer pointer on every municipality's
 * `community` overlay from the old `adminUserId` key to `organizerId`
 * (see docs/plans/ongoing/membership-roles-and-audit.md). The value is
 * copied verbatim, then the old key is deleted.
 *
 * USAGE
 *   node scripts/backfill-organizer-id.mjs
 *
 * ROLLOUT ORDERING (important): the strict Zod converter now expects
 * `community.organizerId`, so this MUST run together with the deploy of the
 * renamed code to the target env — never before the new code is live (the old
 * deployed code reads `adminUserId`) and never long after (the new code reads
 * `organizerId`). On dev, run it right after the develop deploy.
 *
 * Idempotent: patches only docs that still carry the old key or lack the new
 * one; docs already migrated are skipped.
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'villa-events';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS is not set.');
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

if (admin.app().options.projectId !== PROJECT_ID) {
  console.error(`Refusing to run against ${admin.app().options.projectId} — dev only.`);
  process.exit(1);
}

async function main() {
  const snap = await db.collection('municipalities').get();
  console.log(`Loaded ${snap.size} municipality docs.`);

  let needsPatch = 0;
  let alreadyMigrated = 0;
  let noCommunity = 0;
  let batch = db.batch();
  let inBatch = 0;
  let committed = 0;

  for (const docSnap of snap.docs) {
    const community = docSnap.data().community;
    if (community == null) {
      noCommunity++;
      continue;
    }
    const hasOldKey = Object.prototype.hasOwnProperty.call(community, 'adminUserId');
    const hasNewKey = Object.prototype.hasOwnProperty.call(community, 'organizerId');
    if (hasNewKey && !hasOldKey) {
      alreadyMigrated++;
      continue;
    }
    // Copy the old value (may be null = wiki phase) to the new key; drop old.
    batch.update(docSnap.ref, {
      'community.organizerId': hasOldKey ? (community.adminUserId ?? null) : null,
      'community.adminUserId': FieldValue.delete(),
    });
    needsPatch++;
    inBatch++;
    if (inBatch >= 400) {
      await batch.commit();
      committed += inBatch;
      console.log(`  Committed ${committed}/${needsPatch} patches so far...`);
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) {
    await batch.commit();
    committed += inBatch;
  }

  console.log(`\nDone.`);
  console.log(`  No community (skipped): ${noCommunity}`);
  console.log(`  Already migrated:       ${alreadyMigrated}`);
  console.log(`  Patched:                ${needsPatch}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
