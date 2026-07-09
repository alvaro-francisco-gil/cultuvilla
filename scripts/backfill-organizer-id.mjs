#!/usr/bin/env node
/**
 * backfill-organizer-id.mjs
 *
 * One-off: rename the village organizer pointer on every municipality's
 * `community` overlay from the old `adminUserId` key to `organizerId`
 * (see docs/plans/ongoing/membership-roles-and-audit.md). The value is
 * copied verbatim, then the old key is deleted.
 *
 * USAGE
 *   node scripts/backfill-organizer-id.mjs [--env <dev|beta|prod>] [--yes]
 *
 *   node scripts/backfill-organizer-id.mjs                 # dev (villa-events)
 *   node scripts/backfill-organizer-id.mjs --env beta --yes
 *
 * CREDENTIALS
 *   Resolved per env via scripts/lib/env-credentials.mjs (dev = key at
 *   ~/.config/cultuvilla/dev-sa.json; beta/prod = keyless ADC at
 *   ~/.config/cultuvilla/adc.json). See docs/ENVIRONMENTS.md.
 *
 * ROLLOUT ORDERING (important): the strict Zod converter now expects
 * `community.organizerId`, so this MUST run together with the deploy of the
 * renamed code to the target env — never before the new code is live (the old
 * deployed code reads `adminUserId`) and never long after (the new code reads
 * `organizerId`). Run it right after the env's deploy completes.
 *
 * SAFETY
 *   - Defaults to dev; beta/prod refuse to run without an explicit `--yes`.
 *   - projectId is pinned per env by the resolver.
 *
 * Idempotent: patches only docs that still carry the old key or lack the new
 * one; docs already migrated are skipped.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

const envArg = argValue('--env') ?? 'dev';
const yes = process.argv.includes('--yes');

let ctx;
try {
  ctx = initAdminForEnv(envArg);
} catch (err) {
  console.error(`[backfill-organizer-id] ${err.message}`);
  process.exit(1);
}

if (ctx.env !== 'dev' && !yes) {
  console.error(
    `[backfill-organizer-id] Refusing to run against ${ctx.projectId} (${ctx.env}) without --yes.`,
  );
  process.exit(1);
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

async function main() {
  console.log(`[backfill-organizer-id] env=${ctx.env} project=${ctx.projectId} auth=${ctx.auth}`);
  const snap = await db.collection('municipalities').get();
  console.log(`Loaded ${snap.size} municipality docs.`);

  let needsPatch = 0;
  let alreadyMigrated = 0;
  let noCommunity = 0;
  let batch = db.batch();
  let inBatch = 0;
  let committed = 0;

  for (const docSnap of snap.docs) {
    const community = docSnap.data().community;
    if (community == null) {
      noCommunity++;
      continue;
    }
    const hasOldKey = Object.prototype.hasOwnProperty.call(community, 'adminUserId');
    const hasNewKey = Object.prototype.hasOwnProperty.call(community, 'organizerId');
    if (hasNewKey && !hasOldKey) {
      alreadyMigrated++;
      continue;
    }
    // Copy the old value (may be null = wiki phase) to the new key; drop old.
    batch.update(docSnap.ref, {
      'community.organizerId': hasOldKey ? (community.adminUserId ?? null) : null,
      'community.adminUserId': FieldValue.delete(),
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
  console.log(`  No community (skipped): ${noCommunity}`);
  console.log(`  Already migrated:       ${alreadyMigrated}`);
  console.log(`  Patched:                ${needsPatch}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
