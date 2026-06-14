/**
 * Dataset loader. Reads `scripts/data/seed-fixtures/<dataset>/fixtures.mjs`
 * and normalizes its shape so seeders can assume the optional arrays exist.
 */

import { existsSync, readdirSync } from 'fs';
import { pathToFileURL } from 'url';
import path from 'path';

import { DATASET, DATASET_DIR, FIXTURES_ROOT, db, uidForEmail } from './context.mjs';
import { villageDocId } from './ids.mjs';

export async function loadDataset() {
  const fixturesPath = path.join(DATASET_DIR, 'fixtures.mjs');
  if (!existsSync(fixturesPath)) {
    const available = existsSync(FIXTURES_ROOT)
      ? readdirSync(FIXTURES_ROOT, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
      : [];
    console.error(
      `[seed] Dataset "${DATASET}" not found at scripts/data/seed-fixtures/${DATASET}/fixtures.mjs\n` +
        `       Available: ${available.join(', ') || '(none)'}`,
    );
    process.exit(1);
  }

  const mod = await import(pathToFileURL(fixturesPath).href);
  const data = mod.default ?? mod;
  if (!data || typeof data !== 'object') {
    throw new Error(`Dataset "${DATASET}" must default-export an object`);
  }
  // Both arrays are optional: a "users-only" dataset has no villages, and a
  // request-flow dataset (real_villages_1) has villages but no users[] of its
  // own (it reuses real_user_data_1's accounts, resolved by email).
  data.users ??= [];
  data.villages ??= [];
  return data;
}

/** Look up a user's email by their dataset `ref` (e.g. "admin"). */
export function emailForRef(dataset, ref) {
  const u = dataset.users.find((x) => x.ref === ref);
  if (!u) throw new Error(`User ref "${ref}" not found in dataset.users[]`);
  return u.email;
}

/** Resolve an Auth uid from a dataset user `ref` (requires users seeded). */
export async function uidForRef(dataset, ref) {
  return uidForEmail(emailForRef(dataset, ref));
}

/**
 * Resolve a fixture village to its Firestore municipality doc id, a stable key
 * for namespacing child docs, and the admin uid — handling both village styles:
 *
 *   - direct-seed  (demo_1):        `adminUserRef` + deterministic doc id.
 *   - request-flow (real_villages): `organizerEmail` + INE lookup of the real,
 *                                    community-activated municipality doc.
 */
export async function resolveVillage(dataset, v) {
  if (v.organizerEmail) {
    const snap = await db
      .collection('municipalities')
      .where('codigoINE', '==', v.codigoINE)
      .limit(1)
      .get();
    if (snap.empty) {
      throw new Error(
        `No municipality with codigoINE="${v.codigoINE}" (${v.name ?? '?'}). ` +
          `Run \`pnpm seed:municipalities\` then \`DATASET=${DATASET} pnpm seed:villages\` first.`,
      );
    }
    const doc = snap.docs[0];
    if (!doc.get('communityActive')) {
      console.warn(
        `[seed] ${v.name ?? v.codigoINE} is not community-active yet — ` +
          `run \`DATASET=${DATASET} pnpm seed:villages\` to activate it.`,
      );
    }
    return { vDocId: doc.id, vKey: v.id, adminUid: await uidForEmail(v.organizerEmail) };
  }
  return { vDocId: villageDocId(v.id), vKey: v.id, adminUid: await uidForRef(dataset, v.adminUserRef) };
}
