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
 * getBarrioResidentCount used) and writes it. Doubles as a repair tool if the
 * trigger ever drifts. Idempotent: writes only when the stored value differs.
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

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();

async function main() {
  console.log(`Backfilling barrios.residentCount against ${projectId}\n`);

  const munis = await db.collection('municipalities').get();
  let total = 0;
  let patched = 0;

  for (const muni of munis.docs) {
    const barrios = await muni.ref.collection('barrios').get();
    for (const barrio of barrios.docs) {
      total++;
      const count = (
        await db
          .collection('persons')
          .where('municipalityLinks', 'array-contains', {
            municipalityId: muni.id,
            barrioId: barrio.id,
          })
          .count()
          .get()
      ).data().count;
      if (barrio.data().residentCount === count) continue;
      await barrio.ref.update({ residentCount: count });
      patched++;
    }
  }

  console.log(`Done. barrios: ${total} docs — patched ${patched}, already correct ${total - patched}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
