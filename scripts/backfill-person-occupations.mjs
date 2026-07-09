#!/usr/bin/env node
/**
 * backfill-person-occupations.mjs
 *
 * One-off: migrates persons + the `occupations/` collection off the old
 * moderated-catalog shape onto the new collected free-text model, and
 * deletes the now-superseded `occupationProposals/` collection.
 *
 * OLD state:
 *   - person.occupationIds: string[]      — doc ids into the OLD `occupations/`
 *     collection, whose docs were { name, createdBy, createdAt }
 *   - person.pendingOccupations: string[] — free-text entries awaiting approval
 *   - occupationProposals/{id}            — moderation queue for the above
 *
 * NEW state (see packages/shared/src/models/person/PersonDataModel.ts and
 * packages/shared/src/models/occupation/OccupationDataModel.ts):
 *   - person.occupations: string[]        — each entry is either an
 *     OCCUPATION_CATALOG key or a free-text string
 *   - occupations/{slug}                  — collected tally, { name, count,
 *     updatedAt }, doc id = slugifyOccupation(name), refilled organically by
 *     occupationService.recordOccupation() as users submit free text again
 *   - occupationProposals/ no longer exists
 *
 * TRANSFORM (per person):
 *   1. Resolve each `occupationIds` entry to its OLD occupation doc's `name`
 *      via a preloaded id -> name map. If that name matches an
 *      OCCUPATION_CATALOG key (case-sensitive, catalog keys are already
 *      slug-like), store the catalog KEY; otherwise store the name string
 *      verbatim (a legacy custom occupation, becomes a free-text entry).
 *   2. Append each `pendingOccupations` string verbatim (already free text).
 *   3. De-dupe (Set) and write as `occupations`.
 *   4. Delete `occupationIds` and `pendingOccupations` via FieldValue.delete().
 *
 * OCCUPATIONS/ COLLECTION REBUILD — chosen approach: WIPE, don't re-key.
 *   The old docs are keyed by an opaque auto-id and carry {name, createdBy,
 *   createdAt} (no `count`); there is no reliable historical submission count
 *   to reconstruct, and `createdBy` has no meaning in the new "collected
 *   tally" model. Re-keying to slug ids with a synthetic `count: 1` would
 *   produce data that *looks* like a real tally but isn't — worse than empty.
 *   occupationService.recordOccupation() upserts (merge: true) on every
 *   free-text submission, so the collection refills organically and
 *   accurately as soon as persons resubmit. We only delete docs still in the
 *   OLD shape (missing `count`/`updatedAt`), so this step is idempotent and
 *   never touches docs the new code has already written.
 *
 * OCCUPATIONPROPOSALS/ — deleted outright (collection is fully superseded;
 * no data from it is carried forward).
 *
 * Idempotent: a person is skipped once it has an `occupations` field and
 * lacks both `occupationIds` and `pendingOccupations`. Old `occupations/`
 * docs are skipped once they're in the new shape. `occupationProposals/` is
 * idempotent by construction (deleting an empty collection is a no-op).
 *
 * USAGE
 *   node scripts/backfill-person-occupations.mjs
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointed at a villa-events (dev)
 * service account. See the firebase-admin-dev skill. Dev only — refuses to
 * run against any other project ID.
 *
 * NOTE: imports `isCatalogOccupation` from the built `@cultuvilla/shared`
 * dist — run `pnpm shared:build` first if `dist/` is stale.
 */

import admin from 'firebase-admin';
import { isCatalogOccupation } from '@cultuvilla/shared';

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

/**
 * Shared batcher: commits every `limit` writes, tracks a total count.
 * Returns { queue(ref, data | null), flush() } — pass `null` data to delete.
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
    if (data === null) {
      batch.delete(ref);
    } else {
      batch.update(ref, data);
    }
    inBatch++;
    if (inBatch >= limit) {
      await flush();
      console.log(`  [${label}] committed ${committed} so far...`);
    }
  }

  return {
    queue,
    flush,
    get committed() {
      return committed;
    },
  };
}

/** Mirrors occupationService.slugifyOccupation (kept in sync manually). */
function slugifyOccupation(name) {
  return name
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

async function loadOldOccupationNameMap() {
  const snap = await db.collection('occupations').get();
  const map = new Map();
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (typeof data.name === 'string') {
      map.set(docSnap.id, data.name);
    }
  }
  return { snap, map };
}

async function migratePersons(oldNameById) {
  const snap = await db.collection('persons').get();
  console.log(`\npersons: loaded ${snap.size} docs.`);

  let alreadyDone = 0;
  let patched = 0;
  let skippedMissingName = 0;
  let catalogMatches = 0;
  let freeTextEntries = 0;
  const batcher = makeBatcher('persons');

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const hasOldFields = data.occupationIds !== undefined || data.pendingOccupations !== undefined;
    const alreadyNewShape = data.occupations !== undefined && !hasOldFields;

    if (alreadyNewShape) {
      alreadyDone++;
      continue;
    }

    const occupationIds = Array.isArray(data.occupationIds) ? data.occupationIds : [];
    const pendingOccupations = Array.isArray(data.pendingOccupations) ? data.pendingOccupations : [];

    const resolved = [];
    for (const id of occupationIds) {
      const name = oldNameById.get(id);
      if (name === undefined) {
        skippedMissingName++;
        continue;
      }
      // Old occupation names that match a catalog key are already stored as
      // exactly that key string (e.g. name === 'agricultor'), so the value
      // written is `name` either way — isCatalogOccupation only splits the
      // count for the summary log below.
      if (isCatalogOccupation(name)) {
        catalogMatches++;
      } else {
        freeTextEntries++;
      }
      resolved.push(name);
    }
    // pendingOccupations are already free text; keep verbatim.
    for (const name of pendingOccupations) {
      if (typeof name === 'string') resolved.push(name);
    }

    const existing = Array.isArray(data.occupations) ? data.occupations : [];
    const merged = Array.from(new Set([...existing, ...resolved]));

    await batcher.queue(docSnap.ref, {
      occupations: merged,
      occupationIds: FieldValue.delete(),
      pendingOccupations: FieldValue.delete(),
    });
    patched++;
  }
  await batcher.flush();

  console.log(
    `persons: already correct ${alreadyDone}, patched ${patched}, occupationIds with no matching old doc ${skippedMissingName} ` +
      `(resolved occupationIds: ${catalogMatches} catalog-key matches, ${freeTextEntries} free-text).`,
  );
  return { alreadyDone, patched, skippedMissingName, catalogMatches, freeTextEntries };
}

async function wipeOldOccupationsCollection(oldSnap) {
  console.log(`\noccupations: scanned ${oldSnap.size} docs.`);

  let alreadyNewShape = 0;
  let deleted = 0;
  const batcher = makeBatcher('occupations');

  for (const docSnap of oldSnap.docs) {
    const data = docSnap.data();
    const isNewShape = typeof data.count === 'number' && data.updatedAt !== undefined;
    if (isNewShape) {
      alreadyNewShape++;
      continue;
    }
    await batcher.queue(docSnap.ref, null);
    deleted++;
  }
  await batcher.flush();

  console.log(`occupations: already new shape (kept) ${alreadyNewShape}, deleted (old shape) ${deleted}.`);
  return { alreadyNewShape, deleted };
}

async function deleteOccupationProposals() {
  const snap = await db.collection('occupationProposals').get();
  console.log(`\noccupationProposals: found ${snap.size} docs.`);

  const batcher = makeBatcher('occupationProposals');
  for (const docSnap of snap.docs) {
    await batcher.queue(docSnap.ref, null);
  }
  await batcher.flush();

  console.log(`occupationProposals: deleted ${snap.size} docs.`);
  return { deleted: snap.size };
}

async function main() {
  const { snap: oldOccupationsSnap, map: oldNameById } = await loadOldOccupationNameMap();

  const personsResult = await migratePersons(oldNameById);
  const occupationsResult = await wipeOldOccupationsCollection(oldOccupationsSnap);
  const proposalsResult = await deleteOccupationProposals();

  console.log('\n=== Summary ===');
  console.log(
    `  persons: already correct ${personsResult.alreadyDone}, patched ${personsResult.patched}, unresolved occupationIds ${personsResult.skippedMissingName}`,
  );
  console.log(
    `  occupations: kept (new shape) ${occupationsResult.alreadyNewShape}, deleted (old shape) ${occupationsResult.deleted}`,
  );
  console.log(`  occupationProposals: deleted ${proposalsResult.deleted}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
