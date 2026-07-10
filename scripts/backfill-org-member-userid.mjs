#!/usr/bin/env node
/**
 * backfill-org-member-userid.mjs
 *
 * One-off: for every organizations/{orgId}/members/{userId} doc in dev
 * Firestore that lacks `userId`, set it to the doc id and patch the doc.
 *
 * USAGE
 *   node scripts/backfill-org-member-userid.mjs                       # dev
 *   env -u GOOGLE_APPLICATION_CREDENTIALS node \
 *     scripts/backfill-org-member-userid.mjs --env beta --yes         # beta/prod
 *
 * Idempotent: re-runs only patch docs whose `userId` is still missing.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';

// `--env dev|beta|prod` (default dev). Non-dev requires an explicit `--yes`.
// For --env beta/prod, unset GOOGLE_APPLICATION_CREDENTIALS first so the
// resolver uses the stored ADC (a dev key would auth to the wrong project).
function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}
const envArg = argValue('--env') ?? 'dev';
const yes = process.argv.includes('--yes');

const { env, projectId } = initAdminForEnv(envArg);
if (env !== 'dev' && !yes) {
  console.error(`Refusing to run against non-dev env "${env}" (${projectId}) without --yes.`);
  process.exit(1);
}
console.log(`Backfill target: ${env} (${projectId})\n`);
const db = admin.firestore();

async function main() {
  const orgsSnap = await db.collection('organizations').get();
  console.log(`Loaded ${orgsSnap.size} organization docs.`);

  let needsPatch = 0;
  let alreadyCorrect = 0;
  let batch = db.batch();
  let inBatch = 0;
  let committed = 0;

  for (const orgSnap of orgsSnap.docs) {
    const membersSnap = await orgSnap.ref.collection('members').get();
    for (const memberSnap of membersSnap.docs) {
      const data = memberSnap.data();
      if (data.userId === memberSnap.id) {
        alreadyCorrect++;
        continue;
      }
      batch.update(memberSnap.ref, { userId: memberSnap.id });
      needsPatch++;
      inBatch++;
      if (inBatch >= 400) {
        await batch.commit();
        committed += inBatch;
        console.log(`  Committed ${committed}/${needsPatch} patches so far...`);
        batch = db.batch();
        inBatch = 0;
      }
    }
  }
  if (inBatch > 0) {
    await batch.commit();
    committed += inBatch;
  }

  console.log(`\nDone.`);
  console.log(`  Already correct: ${alreadyCorrect}`);
  console.log(`  Patched:         ${needsPatch}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
