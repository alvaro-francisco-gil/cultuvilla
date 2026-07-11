#!/usr/bin/env node
/**
 * backfill-org-members-public.mjs
 *
 * One-off: `OrganizationDataSchema.membersPublic` was added after some org docs
 * already existed. The strict converter throws on docs missing it. This sets the
 * builder default (`true`) on every org doc that lacks the field.
 *
 * USAGE
 *   node scripts/backfill-org-members-public.mjs                 (dev dry run)
 *   node scripts/backfill-org-members-public.mjs --apply         (dev writes)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-org-members-public.mjs --env=beta --confirm --apply
 *
 * Credentials resolve via initAdminForEnv (see lib/env-credentials.mjs). Dev is
 * autonomous; beta/prod require --confirm (and the stored ADC — unset
 * GOOGLE_APPLICATION_CREDENTIALS so a dev key can't hijack the target project).
 * `--apply` still gates the actual write on every env (dry run without it).
 *
 * Idempotent: skips any org doc that already has `membersPublic` set.
 */
import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';
import { parseEnvConfirm } from './lib/env-confirm.mjs';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');

async function main() {
  const orgs = await db.collection('organizations').get();
  console.log(`Backfilling membersPublic against ${projectId}`);
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
