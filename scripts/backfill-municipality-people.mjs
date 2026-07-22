#!/usr/bin/env node
/**
 * Rebuilds the function-owned municipality people directory from canonical
 * persons.municipalityLinks. Dev only; safe to re-run after a partial deploy.
 *
 * Usage: pnpm shared:build && node scripts/backfill-municipality-people.mjs
 */
import { initAdminForEnv } from './lib/env-credentials.mjs';

const { projectId } = initAdminForEnv('dev');
if (projectId !== 'villa-events') {
  throw new Error(`Refusing to run against ${projectId} — dev only.`);
}

const { default: admin } = await import('firebase-admin');
const db = admin.firestore();

function displayName(data) {
  return [data.givenName, ...(Array.isArray(data.middleNames) ? data.middleNames : []), data.firstSurname, data.secondSurname]
    .filter((part) => typeof part === 'string' && part.length > 0)
    .join(' ');
}

function sortName(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-ES');
}

const persons = await db.collection('persons').get();
const existing = await db.collection('municipalityPeople').get();
const expectedIds = new Set();
let writes = 0;
let batch = db.batch();
for (const person of persons.docs) {
  const data = person.data();
  const name = displayName(data);
  const municipalityIds = new Set(
    (Array.isArray(data.municipalityLinks) ? data.municipalityLinks : [])
      .flatMap((link) => typeof link?.municipalityId === 'string' ? [link.municipalityId] : []),
  );
  for (const municipalityId of municipalityIds) {
    const directoryId = `${municipalityId}_${person.id}`;
    expectedIds.add(directoryId);
    batch.set(db.collection('municipalityPeople').doc(directoryId), {
      municipalityId,
      personId: person.id,
      displayName: name,
      sortName: sortName(name),
      photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
      userId: typeof data.userId === 'string' ? data.userId : null,
    });
    writes += 1;
    if (writes % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
}
for (const row of existing.docs) {
  if (expectedIds.has(row.id)) continue;
  batch.delete(row.ref);
  writes += 1;
  if (writes % 400 === 0) {
    await batch.commit();
    batch = db.batch();
  }
}
if (writes % 400 !== 0) await batch.commit();
console.log(`Reconciled ${writes} municipality people directory writes from ${persons.size} persons.`);
