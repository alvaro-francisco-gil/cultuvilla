#!/usr/bin/env node
/**
 * Backfills `barrioId` on `municipalityPeople/{id}`, projected from the
 * person's `municipalityLinks` entry for that municipality.
 *
 * The barrio roster now reads this directory instead of querying `persons`
 * directly, so every row needs the field — the schema requires it (strict Zod
 * converter) and the barrio query filters on it. `syncMunicipalityPeople`
 * writes it going forward; this refreshes rows written before the change.
 *
 * Dev only. Re-running is safe: only rows whose projected barrio differs are
 * patched.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';

const { projectId } = initAdminForEnv('dev');
if (projectId !== 'villa-events') {
  throw new Error(`Refusing to backfill ${projectId}; this script is dev only.`);
}

const db = admin.firestore();

/** Mirrors the trigger: first link naming a barrio wins, else null. */
function barrioFor(person, municipalityId) {
  const links = Array.isArray(person.municipalityLinks) ? person.municipalityLinks : [];
  for (const link of links) {
    if (!link || typeof link !== 'object') continue;
    if (link.municipalityId !== municipalityId) continue;
    if (typeof link.barrioId === 'string' && link.barrioId.length > 0) return link.barrioId;
  }
  return null;
}

async function main() {
  console.log(`Backfilling municipalityPeople.barrioId against ${projectId}`);

  const persons = await db.collection('persons').get();
  const byId = new Map(persons.docs.map((d) => [d.id, d.data()]));

  const rows = await db.collection('municipalityPeople').get();
  let patched = 0;
  let batch = db.batch();
  let batchSize = 0;

  for (const rowSnap of rows.docs) {
    const row = rowSnap.data();
    const person = byId.get(row.personId);
    if (!person) continue; // orphan row; left for the trigger's delete path
    const barrioId = barrioFor(person, row.municipalityId);
    if (row.barrioId === barrioId) continue;
    batch.update(rowSnap.ref, { barrioId });
    patched += 1;
    batchSize += 1;
    if (batchSize === 400) {
      await batch.commit();
      batch = db.batch();
      batchSize = 0;
    }
  }
  if (batchSize > 0) await batch.commit();
  console.log(
    `municipalityPeople: ${rows.size} docs — patched ${patched}, already conformant ${rows.size - patched}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
