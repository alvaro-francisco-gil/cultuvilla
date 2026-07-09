#!/usr/bin/env node
/**
 * backfill-visibility-status.mjs
 *
 * One-off: migrates the four moderated content collections off the old
 * pending/approved/rejected review lifecycle (`ReviewableDataModel`) onto the
 * new active/hidden visibility model (`VisibilityModel` — see
 * packages/shared/src/models/core/VisibilityModel.ts).
 *
 * Collections touched:
 *   - news/{postId}                                   (top-level)
 *   - festivalPosters/{posterId}                       (top-level)
 *   - municipalities/{id}/barrios/{barrioId}           (subcollection)
 *   - municipalities/{id}/places/{placeId}             (subcollection)
 *
 * Field mapping (old -> new):
 *   status: 'approved' | 'pending' -> 'active'
 *   status: 'rejected' (news only)  -> 'hidden', hiddenReason <- rejectionReason
 *   status: 'rejected' (posters — no rejected semantics carried, but map
 *     defensively if any exist) -> 'hidden', hiddenReason: null
 *   + hiddenBy: null, hiddenAt: null, hiddenReason: null (unless set above)
 *   news only: submittedAt -> createdAt (renamed, not duplicated)
 *   DELETE (all four): reviewedBy, reviewedAt
 *   DELETE (news only): rejectionReason, submittedAt
 *
 * Idempotent: a doc is skipped if its `status` is already 'active'/'hidden'
 * AND it carries none of the old fields (reviewedBy, reviewedAt,
 * rejectionReason, submittedAt) — i.e. it's already fully in the new shape.
 *
 * USAGE
 *   node scripts/backfill-visibility-status.mjs
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointed at a villa-events (dev)
 * service account. See the firebase-admin-dev skill. Dev only — refuses to
 * run against any other project ID.
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

const FieldValue = admin.firestore.FieldValue;

/** True for docs at municipalities/{id}/<subcollection>/{docId}. */
function isMunicipalitySubcollectionDoc(docRef) {
  return docRef.parent.parent?.parent?.id === 'municipalities';
}

/**
 * Shared batcher: commits every `limit` writes, tracks a total count.
 * Returns { queue(ref, data), flush() }.
 */
function makeBatcher(label, limit = 400) {
  let batch = db.batch();
  let inBatch = 0;
  let committed = 0;

  async function flush() {
    if (inBatch > 0) {
      await batch.commit();
      committed += inBatch;
      batch = db.batch();
      inBatch = 0;
    }
  }

  async function queue(ref, data) {
    batch.update(ref, data);
    inBatch++;
    if (inBatch >= limit) {
      await flush();
      console.log(`  [${label}] committed ${committed} so far...`);
    }
  }

  return { queue, flush, get committed() { return committed; } };
}

/** Old fields shared by every collection under the review-decision mixin. */
function isReviewedByAtPresent(data) {
  return data.reviewedBy !== undefined || data.reviewedAt !== undefined;
}

function mapOldStatus(status) {
  if (status === 'active' || status === 'hidden') return status;
  if (status === 'rejected') return 'hidden';
  // 'approved' | 'pending' | anything else unrecognized falls through to active.
  return 'active';
}

async function migrateNews() {
  const snap = await db.collection('news').get();
  console.log(`\nnews: loaded ${snap.size} docs.`);

  let alreadyDone = 0;
  let patched = 0;
  const batcher = makeBatcher('news');

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const hasOldFields =
      isReviewedByAtPresent(data) ||
      data.rejectionReason !== undefined ||
      data.submittedAt !== undefined;
    const alreadyNewShape =
      (data.status === 'active' || data.status === 'hidden') && !hasOldFields;

    if (alreadyNewShape) {
      alreadyDone++;
      continue;
    }

    const newStatus = mapOldStatus(data.status);
    const wasRejected = data.status === 'rejected';

    const update = {
      status: newStatus,
      hiddenBy: data.hiddenBy ?? null,
      hiddenAt: data.hiddenAt ?? null,
      hiddenReason: wasRejected ? (data.rejectionReason ?? null) : (data.hiddenReason ?? null),
      reviewedBy: FieldValue.delete(),
      reviewedAt: FieldValue.delete(),
      rejectionReason: FieldValue.delete(),
    };

    // Rename submittedAt -> createdAt (only if createdAt isn't already set).
    if (data.createdAt === undefined && data.submittedAt !== undefined) {
      update.createdAt = data.submittedAt;
    }
    update.submittedAt = FieldValue.delete();

    await batcher.queue(docSnap.ref, update);
    patched++;
  }
  await batcher.flush();

  console.log(`news: already correct ${alreadyDone}, patched ${patched}.`);
  return { alreadyDone, patched };
}

async function migrateFestivalPosters() {
  const snap = await db.collection('festivalPosters').get();
  console.log(`\nfestivalPosters: loaded ${snap.size} docs.`);

  let alreadyDone = 0;
  let patched = 0;
  const batcher = makeBatcher('festivalPosters');

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const hasOldFields = isReviewedByAtPresent(data) || data.rejectionReason !== undefined;
    const alreadyNewShape =
      (data.status === 'active' || data.status === 'hidden') && !hasOldFields;

    if (alreadyNewShape) {
      alreadyDone++;
      continue;
    }

    const newStatus = mapOldStatus(data.status);

    const update = {
      status: newStatus,
      hiddenBy: data.hiddenBy ?? null,
      hiddenAt: data.hiddenAt ?? null,
      hiddenReason: data.hiddenReason ?? null,
      reviewedBy: FieldValue.delete(),
      reviewedAt: FieldValue.delete(),
    };
    // festivalPosters never had a rejectionReason field, but delete
    // defensively in case a stray doc carries one.
    if (data.rejectionReason !== undefined) {
      update.rejectionReason = FieldValue.delete();
    }

    await batcher.queue(docSnap.ref, update);
    patched++;
  }
  await batcher.flush();

  console.log(`festivalPosters: already correct ${alreadyDone}, patched ${patched}.`);
  return { alreadyDone, patched };
}

async function migrateSubcollection(name) {
  const snap = await db.collectionGroup(name).get();
  console.log(`\n${name}: scanned ${snap.size} '${name}' docs (collection group).`);

  let alreadyDone = 0;
  let patched = 0;
  let skippedNotMunicipality = 0;
  const batcher = makeBatcher(name);

  for (const docSnap of snap.docs) {
    if (!isMunicipalitySubcollectionDoc(docSnap.ref)) {
      skippedNotMunicipality++;
      continue;
    }

    const data = docSnap.data();
    const hasOldFields = isReviewedByAtPresent(data);
    const alreadyNewShape =
      (data.status === 'active' || data.status === 'hidden') && !hasOldFields;

    if (alreadyNewShape) {
      alreadyDone++;
      continue;
    }

    const newStatus = mapOldStatus(data.status);

    const update = {
      status: newStatus,
      hiddenBy: data.hiddenBy ?? null,
      hiddenAt: data.hiddenAt ?? null,
      hiddenReason: data.hiddenReason ?? null,
      reviewedBy: FieldValue.delete(),
      reviewedAt: FieldValue.delete(),
    };

    await batcher.queue(docSnap.ref, update);
    patched++;
  }
  await batcher.flush();

  console.log(
    `${name}: already correct ${alreadyDone}, patched ${patched}, skipped (not under municipalities) ${skippedNotMunicipality}.`
  );
  return { alreadyDone, patched };
}

async function main() {
  const results = {};
  results.news = await migrateNews();
  results.festivalPosters = await migrateFestivalPosters();
  results.barrios = await migrateSubcollection('barrios');
  results.places = await migrateSubcollection('places');

  console.log('\n=== Summary ===');
  for (const [name, { alreadyDone, patched }] of Object.entries(results)) {
    console.log(`  ${name}: already correct ${alreadyDone}, patched ${patched}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
