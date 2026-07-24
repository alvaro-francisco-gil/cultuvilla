#!/usr/bin/env node
/**
 * backfill-barrio-resident-count.mjs
 *
 * One-off: the village hub now orders barrios by population, backed by a
 * REQUIRED denormalized `residentCount` on each `municipalities/{id}/barrios/{bid}`
 * doc (kept live by functions/src/village/syncBarrioResidentCount.ts). Existing
 * dev docs predate the field, so the strict Zod converter throws on read.
 *
 * Recomputes the true count from `persons` (people whose `municipalityLinks`
 * contains `{ municipalityId, barrioId }` — the same query the old
 * getBarrioResidentCount used), excluding deceased personas (a death date or a
 * cemetery burial — they belong to the cemetery, not the resident count,
 * matching syncBarrioResidentCount), and writes it. Doubles as a repair tool if
 * the trigger ever drifts. Idempotent: writes only when the stored value differs.
 *
 * USAGE
 *   node scripts/backfill-barrio-resident-count.mjs               (dev, default)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-barrio-resident-count.mjs --env=beta --confirm
 *
 * Credentials resolve via initAdminForEnv (see lib/env-credentials.mjs). Dev is
 * autonomous; beta/prod require --confirm (and the stored ADC — unset
 * GOOGLE_APPLICATION_CREDENTIALS so a dev key can't hijack the target project).
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';
import { parseEnvConfirm } from './lib/env-confirm.mjs';
import { backfillCollection, activeMunicipalityDocs } from './lib/backfill.mjs';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();

async function residentCountFor(municipalityId, barrioId) {
  const residents = await db
    .collection('persons')
    .where('municipalityLinks', 'array-contains', { municipalityId, barrioId })
    .get();
  // Deceased personas are excluded (see header) — Firestore can't express
  // this in the aggregation, so we count living docs in JS.
  return residents.docs.filter((doc) => {
    const data = doc.data();
    return data.deathDate == null && data.burialPlace == null;
  }).length;
}

async function main() {
  console.log(`Backfilling barrios.residentCount against ${projectId}\n`);

  const munis = await db.collection('municipalities').get();
  const activeMunis = activeMunicipalityDocs(munis);
  let total = 0;
  let patched = 0;

  for (const muni of activeMunis) {
    const result = await backfillCollection(
      db,
      `municipalities/${muni.id}/barrios`,
      muni.ref.collection('barrios'),
      async (data, docSnap) => {
        const count = await residentCountFor(muni.id, docSnap.id);
        return data.residentCount === count ? null : { residentCount: count };
      },
    );
    total += result.total;
    patched += result.patched;
  }

  console.log(
    `Done. barrios: ${total} docs across ${activeMunis.length} active of ${munis.size} municipalities — patched ${patched}, already correct ${total - patched}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
