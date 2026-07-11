#!/usr/bin/env node
/**
 * backfill-org-members-public.mjs
 *
 * One-off: `OrganizationDataSchema.membersPublic` was added after some org docs
 * already existed. The strict converter throws on docs missing it. This sets the
 * builder default (`true`) on every org doc that lacks the field.
 *
 * USAGE
 *   node scripts/backfill-org-members-public.mjs          (dry run — no writes)
 *   node scripts/backfill-org-members-public.mjs --apply  (writes to Firestore)
 *
 * Idempotent: skips any org doc that already has `membersPublic` set.
 */
import admin from 'firebase-admin';

const PROJECT_ID = 'villa-events';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS is not set. See firebase-admin-dev skill.');
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

if (admin.app().options.projectId !== PROJECT_ID) {
  console.error(`Refusing to run against ${admin.app().options.projectId} — dev only.`);
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

async function main() {
  const orgs = await db.collection('organizations').get();
  console.log(`Loaded ${orgs.size} organization docs.`);

  let patched = 0;
  let alreadySet = 0;

  for (const org of orgs.docs) {
    if (org.get('membersPublic') !== undefined) {
      alreadySet++;
      continue; // idempotent skip
    }
    patched++;
    if (APPLY) await org.ref.set({ membersPublic: true }, { merge: true });
  }

  console.log(`\n${APPLY ? 'WROTE' : 'DRY-RUN'}: ${patched} orgs set membersPublic=true`);
  console.log(`  Already set (skipped): ${alreadySet}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
