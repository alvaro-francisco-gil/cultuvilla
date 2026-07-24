/**
 * Shared write-batching helpers for one-off backfill scripts.
 *
 * Every backfill script commits writes in batches of 400 (Firestore's batch
 * limit) and needs to support a dry-run mode (count what would change without
 * writing). This was duplicated inline in every script; centralized here so
 * new backfills don't re-implement it.
 */

const BATCH_LIMIT = 400;

/**
 * Buffers Firestore writes and commits in batches of 400. When `apply` is
 * false, writes are counted but never committed — the dry-run mode every
 * backfill script supports via `--apply`.
 */
export class BatchWriter {
  constructor(db, { apply = true } = {}) {
    this.db = db;
    this.apply = apply;
    this.batch = db.batch();
    this.size = 0;
  }

  async #commitIfFull() {
    if (this.size < BATCH_LIMIT) return;
    await this.flush();
  }

  async set(ref, data, options) {
    if (this.apply) this.batch.set(ref, data, options);
    this.size++;
    await this.#commitIfFull();
  }

  async update(ref, data) {
    if (this.apply) this.batch.update(ref, data);
    this.size++;
    await this.#commitIfFull();
  }

  async delete(ref) {
    if (this.apply) this.batch.delete(ref);
    this.size++;
    await this.#commitIfFull();
  }

  async flush() {
    if (this.size > 0 && this.apply) await this.batch.commit();
    this.batch = this.db.batch();
    this.size = 0;
  }
}

/**
 * Walks one collection (or collection-group) ref, computes a patch per doc via
 * `patchFor(data, docSnap)`, and writes it. `patchFor` may be async; returning
 * null/undefined/{} skips the doc. Logs the standard
 * "label: N docs — patched/would patch X, already conformant Y" line.
 *
 * Returns { total, patched }.
 */
export async function backfillCollection(db, label, collectionRef, patchFor, { apply = true } = {}) {
  const snap = await collectionRef.get();
  const writer = new BatchWriter(db, { apply });
  let patched = 0;

  for (const docSnap of snap.docs) {
    const patch = await patchFor(docSnap.data(), docSnap);
    if (!patch || Object.keys(patch).length === 0) continue;
    patched++;
    await writer.update(docSnap.ref, patch);
  }
  await writer.flush();

  console.log(
    `  ${label}: ${snap.size} docs — ${apply ? 'patched' : 'would patch'} ${patched}, already conformant ${snap.size - patched}`,
  );
  return { total: snap.size, patched };
}

/**
 * Filters a `municipalities` collection snapshot down to docs whose community
 * is active (the only ones with barrios/places/members subcollections worth
 * walking). A doc whose own data() throws is kept in (descend anyway) so a
 * drifted municipality never hides drift in its subcollections.
 */
export function activeMunicipalityDocs(municipalitiesSnap) {
  return municipalitiesSnap.docs.filter((doc) => {
    try {
      return doc.data().communityActive === true;
    } catch {
      return true;
    }
  });
}
