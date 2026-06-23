/**
 * One-off backfill: delete the dangling `coverImages` key from dev Firestore.
 *
 * Context: the `coverImages` field was removed from the village data model
 * (see docs/plans — "village tab cleanup & escudo-only images"). Zod strips
 * unknown keys on read, so legacy docs still carrying `coverImages` already
 * read back fine — this backfill is pure housekeeping to keep stored docs
 * clean. Safe to re-run (idempotent: docs without the key are skipped).
 *
 * Targets (dev project `villa-events` only):
 *   - `municipalities/{id}`              → `community.coverImages`
 *   - `organizerRequests/{requestId}`    → `coverImages`   (top-level collection)
 *
 * Reads are intentionally converter-free (raw `db.collection(...)`) so the
 * stored `coverImages` key is visible — the schema converter would strip it.
 *
 * USAGE
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/cultuvilla/dev-sa.json \
 *     node scripts/backfill/delete-cover-images.mjs --dry-run   # count only
 *   GOOGLE_APPLICATION_CREDENTIALS=... node scripts/backfill/delete-cover-images.mjs
 */
import admin from 'firebase-admin';

const PROJECT_ID = 'villa-events';
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_LIMIT = 400;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    '[backfill] GOOGLE_APPLICATION_CREDENTIALS is unset. Point it at the dev service-account key.',
  );
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });

// Dev-only guard: refuse if the resolved credential/project isn't villa-events.
const resolved = admin.app().options.projectId;
if (resolved !== PROJECT_ID) {
  console.error(`[backfill] Refusing: resolved project "${resolved}" !== ${PROJECT_ID}. Dev-only.`);
  process.exit(1);
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

/**
 * Scan a collection, deleting `fieldPath` from every doc whose data contains
 * `topKey` (a top-level key whose presence we can detect). Returns counts.
 * `hasField(data)` decides whether the doc carries the key to delete.
 */
async function purge({ collection, label, hasField, fieldPath }) {
  const snap = await db.collection(collection).get();
  let found = 0;
  let deleted = 0;
  let batch = db.batch();
  let inBatch = 0;
  for (const doc of snap.docs) {
    if (!hasField(doc.data())) continue;
    found++;
    if (DRY_RUN) continue;
    batch.update(doc.ref, { [fieldPath]: FieldValue.delete() });
    inBatch++;
    deleted++;
    if (inBatch >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (!DRY_RUN && inBatch > 0) await batch.commit();
  console.log(
    `[backfill] ${label}: scanned=${snap.size} with-coverImages=${found} deleted=${DRY_RUN ? 0 : deleted}`,
  );
  return { scanned: snap.size, found, deleted: DRY_RUN ? 0 : deleted };
}

console.log(`[backfill] project=${PROJECT_ID} mode=${DRY_RUN ? 'DRY-RUN (no writes)' : 'WRITE'}`);

await purge({
  collection: 'municipalities',
  label: 'municipalities (community.coverImages)',
  hasField: (d) =>
    d &&
    typeof d.community === 'object' &&
    d.community !== null &&
    Object.prototype.hasOwnProperty.call(d.community, 'coverImages'),
  fieldPath: 'community.coverImages',
});

await purge({
  collection: 'organizerRequests',
  label: 'organizerRequests (coverImages)',
  hasField: (d) => d && Object.prototype.hasOwnProperty.call(d, 'coverImages'),
  fieldPath: 'coverImages',
});

console.log('[backfill] done.');
process.exit(0);
