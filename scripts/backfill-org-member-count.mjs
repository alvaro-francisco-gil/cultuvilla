#!/usr/bin/env node
/**
 * backfill-org-member-count.mjs
 *
 * One-off: the village hub now orders peñas/agrupaciones by size, backed by a
 * REQUIRED denormalized `memberCount` on each `organizations/{orgId}` doc
 * (kept live by functions/src/organizations/syncOrgMemberCount.ts). Existing
 * dev docs predate the field, so the strict Zod converter throws on read.
 *
 * Recomputes the true count from each org's `members` subcollection and writes
 * it — so this doubles as a repair tool if the trigger ever drifts (e.g. a
 * merge-based re-seed that reset the field). Idempotent: writes only when the
 * stored value differs from the recomputed one.
 *
 * USAGE
 *   node scripts/backfill-org-member-count.mjs                     (dev, default)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-org-member-count.mjs --env=beta --confirm
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
  console.log(`Backfilling organizations.memberCount against ${projectId}\n`);

  const orgs = await db.collection('organizations').get();
  let patched = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const orgDoc of orgs.docs) {
    const count = (await orgDoc.ref.collection('members').count().get()).data().count;
    if (orgDoc.data().memberCount === count) continue;
    batch.update(orgDoc.ref, { memberCount: count });
    patched++;
    inBatch++;
    if (inBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();

  console.log(`Done. organizations: ${orgs.size} docs — patched ${patched}, already correct ${orgs.size - patched}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
