#!/usr/bin/env node
/**
 * backfill-terms-acceptance.mjs
 *
 * One-off: for every user doc in dev Firestore that lacks `termsVersion`, stamp
 * the current version and an acceptance timestamp. Existing accounts predate the
 * consent feature; the strict Zod converter now requires these fields, so a doc
 * missing them crashes any screen that reads it. We set `termsAcceptedAt` to the
 * doc's own `createdAt` (best available proxy for when the account was made),
 * falling back to a server timestamp when `createdAt` is absent.
 *
 * USAGE
 *   node scripts/backfill-terms-acceptance.mjs                       # dev
 *   env -u GOOGLE_APPLICATION_CREDENTIALS node \
 *     scripts/backfill-terms-acceptance.mjs --env beta --yes         # beta/prod
 *
 * Idempotent: only patches docs whose `termsVersion` is missing.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';

const TERMS_VERSION = '1.0';

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
  const snap = await db.collection('users').get();
  console.log(`Loaded ${snap.size} user docs.`);

  let needsPatch = 0;
  let alreadyCorrect = 0;
  let batch = db.batch();
  let inBatch = 0;
  let committed = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.termsVersion) {
      alreadyCorrect++;
      continue;
    }
    batch.update(docSnap.ref, {
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: data.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
    });
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
  if (inBatch > 0) {
    await batch.commit();
    committed += inBatch;
  }

  console.log(`\nDone.`);
  console.log(`  Already correct: ${alreadyCorrect}`);
  console.log(`  Patched:         ${needsPatch}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
