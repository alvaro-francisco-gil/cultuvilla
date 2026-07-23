#!/usr/bin/env node
/**
 * Re-projects the `municipalityPeople` directory `displayName` so it carries the
 * person's apodo in parentheses ("Juan García López (Juanito)").
 *
 * The `syncMunicipalityPeople` trigger already writes this shape going forward;
 * this backfill refreshes rows written before the change. `sortName` stays on the
 * plain full name so ordering is unaffected. Dev only. Re-running is safe: only
 * rows whose projection actually changed are patched.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';

const { projectId } = initAdminForEnv('dev');
if (projectId !== 'villa-events') {
  throw new Error(`Refusing to backfill ${projectId}; this script is dev only.`);
}

const db = admin.firestore();

const asString = (value) => (typeof value === 'string' ? value : '');
const asNullableString = (value) => (typeof value === 'string' ? value : null);

function project(data) {
  const middleNames = Array.isArray(data.middleNames)
    ? data.middleNames.filter((n) => typeof n === 'string' && n.length > 0)
    : [];
  const fullName = [
    asString(data.givenName),
    ...middleNames,
    asString(asNullableString(data.firstSurname)),
    asString(asNullableString(data.secondSurname)),
  ]
    .filter((part) => part.length > 0)
    .join(' ');
  const nickname = asNullableString(data.nickname)?.trim();
  const displayName = nickname ? (fullName ? `${fullName} (${nickname})` : nickname) : fullName;
  const sortName = fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('es-ES');
  return { displayName, sortName };
}

async function main() {
  console.log(`Re-projecting municipalityPeople.displayName against ${projectId}`);

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
    const { displayName, sortName } = project(person);
    if (row.displayName === displayName && row.sortName === sortName) continue;
    batch.update(rowSnap.ref, { displayName, sortName });
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
