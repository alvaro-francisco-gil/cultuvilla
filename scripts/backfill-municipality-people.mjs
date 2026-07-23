#!/usr/bin/env node
/**
 * backfill-municipality-people.mjs
 *
 * Rebuilds the function-owned `municipalityPeople` directory from canonical
 * `persons.municipalityLinks`. The `syncMunicipalityPeople` trigger keeps this
 * collection in sync going forward; this backfill is needed once per env to
 * seed rows for persons that existed before the trigger shipped.
 *
 * USAGE
 *   node scripts/backfill-municipality-people.mjs                 (dev dry run)
 *   node scripts/backfill-municipality-people.mjs --apply         (dev writes)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-municipality-people.mjs --env=beta --confirm --apply
 *
 * Credentials resolve via initAdminForEnv (see lib/env-credentials.mjs). Dev is
 * autonomous; beta/prod require --confirm (and the stored ADC — unset
 * GOOGLE_APPLICATION_CREDENTIALS so a dev key can't hijack the target project).
 * `--apply` still gates the actual write on every env (dry run without it).
 *
 * Idempotent: reconciles municipalityPeople to exactly match persons'
 * municipalityLinks — writes missing/changed rows, deletes orphaned ones.
 */
import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';
import { parseEnvConfirm } from './lib/env-confirm.mjs';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');

function displayName(data) {
  const fullName = [data.givenName, ...(Array.isArray(data.middleNames) ? data.middleNames : []), data.firstSurname, data.secondSurname]
    .filter((part) => typeof part === 'string' && part.length > 0)
    .join(' ');
  const nickname = typeof data.nickname === 'string' ? data.nickname.trim() : '';
  return nickname ? (fullName ? `${fullName} (${nickname})` : nickname) : fullName;
}

function sortName(data) {
  const fullName = [data.givenName, ...(Array.isArray(data.middleNames) ? data.middleNames : []), data.firstSurname, data.secondSurname]
    .filter((part) => typeof part === 'string' && part.length > 0)
    .join(' ');
  return fullName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es-ES');
}

async function main() {
  console.log(`Backfilling municipalityPeople against ${projectId}`);

  const persons = await db.collection('persons').get();
  const existing = await db.collection('municipalityPeople').get();
  console.log(`Loaded ${persons.size} person docs, ${existing.size} existing directory rows.`);

  const expected = new Map();
  for (const person of persons.docs) {
    const data = person.data();
    const municipalityIds = new Set(
      (Array.isArray(data.municipalityLinks) ? data.municipalityLinks : [])
        .flatMap((link) => (typeof link?.municipalityId === 'string' ? [link.municipalityId] : [])),
    );
    for (const municipalityId of municipalityIds) {
      const directoryId = `${municipalityId}_${person.id}`;
      expected.set(directoryId, {
        municipalityId,
        personId: person.id,
        displayName: displayName(data),
        sortName: sortName(data),
        photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
        userId: typeof data.userId === 'string' ? data.userId : null,
      });
    }
  }

  const existingById = new Map(existing.docs.map((d) => [d.id, d.data()]));
  let toWrite = 0;
  let toDelete = 0;
  let batch = db.batch();
  let batchSize = 0;

  const commitIfFull = async () => {
    if (batchSize < 400) return;
    if (APPLY) await batch.commit();
    batch = db.batch();
    batchSize = 0;
  };

  for (const [directoryId, row] of expected) {
    const current = existingById.get(directoryId);
    const matches = current
      && current.municipalityId === row.municipalityId
      && current.personId === row.personId
      && current.displayName === row.displayName
      && current.sortName === row.sortName
      && current.photoURL === row.photoURL
      && current.userId === row.userId;
    if (matches) continue;
    toWrite += 1;
    batchSize += 1;
    if (APPLY) batch.set(db.collection('municipalityPeople').doc(directoryId), row);
    await commitIfFull();
  }

  for (const directoryId of existingById.keys()) {
    if (expected.has(directoryId)) continue;
    toDelete += 1;
    batchSize += 1;
    if (APPLY) batch.delete(db.collection('municipalityPeople').doc(directoryId));
    await commitIfFull();
  }

  if (APPLY && batchSize > 0) await batch.commit();

  console.log(`\n${APPLY ? 'WROTE' : 'DRY-RUN'}: ${toWrite} rows set, ${toDelete} orphaned rows deleted`);
  console.log(`  Already conformant (skipped): ${expected.size - toWrite}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
