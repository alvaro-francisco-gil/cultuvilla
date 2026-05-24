#!/usr/bin/env node
/**
 * seed-municipalities.mjs
 *
 * Idempotently seeds the Firestore `municipalities` collection with Spanish
 * provincial capitals (INE codes) from scripts/data/municipalities-es.json.
 *
 * USAGE
 *   pnpm seed:municipalities
 *   # or:
 *   node scripts/seed-municipalities.mjs
 *
 * CREDENTIALS
 *   Authenticate with Application Default Credentials before running:
 *     gcloud auth application-default login
 *   Or set the GOOGLE_APPLICATION_CREDENTIALS env var to a service-account key:
 *     export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 *
 * PROJECT ID
 *   Set GOOGLE_CLOUD_PROJECT env var, or it will be read from firebase.json
 *   (the functions[0].source directory is used to locate firebase.json).
 *
 * FULL INE DATASET
 *   Replace scripts/data/municipalities-es.json with a fuller dataset (same
 *   shape: array of { name, province, comunidadAutonoma, codigoINE }). The
 *   script will pick up whatever entries are in the file. Existing documents
 *   (matched by codigoINE) are skipped so re-runs are safe.
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// ── Resolve project ID ────────────────────────────────────────────────────────

function resolveProjectId() {
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    return process.env.GOOGLE_CLOUD_PROJECT;
  }
  const firebaseJsonPath = path.join(repoRoot, 'firebase.json');
  if (existsSync(firebaseJsonPath)) {
    try {
      const firebaseJson = JSON.parse(readFileSync(firebaseJsonPath, 'utf8'));
      if (firebaseJson.projectId) return firebaseJson.projectId;
    } catch {
      // ignore parse errors, fall through
    }
  }
  return undefined;
}

const projectId = resolveProjectId();
if (!projectId) {
  console.error(
    '[seed] Could not determine project ID.\n' +
      '  Set GOOGLE_CLOUD_PROJECT env var, e.g.:\n' +
      '    GOOGLE_CLOUD_PROJECT=my-project pnpm seed:municipalities',
  );
  process.exit(1);
}

// ── Init firebase-admin ───────────────────────────────────────────────────────

admin.initializeApp({ projectId });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ── Load seed data ────────────────────────────────────────────────────────────

const dataPath = path.join(__dirname, 'data', 'municipalities-es.json');
if (!existsSync(dataPath)) {
  console.error(`[seed] Data file not found: ${dataPath}`);
  process.exit(1);
}

/** @type {Array<{ name: string, province: string, comunidadAutonoma: string, codigoINE: string }>} */
const seedData = JSON.parse(readFileSync(dataPath, 'utf8'));

if (!Array.isArray(seedData) || seedData.length === 0) {
  console.error('[seed] Data file is empty or not an array.');
  process.exit(1);
}

console.log(`[seed] Loaded ${seedData.length} entries from ${dataPath}`);

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const collection = db.collection('municipalities');

  // 1. Fetch all codigoINE values that already exist (single query, no per-doc reads)
  const existingSnap = await collection.select('codigoINE').get();
  const existingCodes = new Set(existingSnap.docs.map((d) => d.data().codigoINE));

  console.log(`[seed] Existing municipalities in Firestore: ${existingCodes.size}`);

  // 2. Determine which entries to write
  const toWrite = seedData.filter((entry) => !existingCodes.has(entry.codigoINE));
  const skipCount = seedData.length - toWrite.length;

  if (toWrite.length === 0) {
    console.log(`[seed] Nothing to write.`);
    console.log(`Created: 0 | Skipped (already existed): ${skipCount}`);
    process.exit(0);
  }

  // 3. Write in batches of max 500
  const BATCH_SIZE = 500;
  let created = 0;

  for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
    const chunk = toWrite.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const entry of chunk) {
      const docRef = collection.doc(); // auto-ID
      batch.set(docRef, {
        name: entry.name,
        province: entry.province,
        comunidadAutonoma: entry.comunidadAutonoma,
        codigoINE: entry.codigoINE,
        coordinates: null,
        escudoUrl: null,
        escudoThumbUrl: null,
        community: null,
        communityActive: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    created += chunk.length;
    console.log(`[seed] Batch committed: ${created}/${toWrite.length} new documents`);
  }

  console.log(`\nCreated: ${created} | Skipped (already existed): ${skipCount}`);
}

main().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
