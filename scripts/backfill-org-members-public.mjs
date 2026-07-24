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
import { backfillCollection } from './lib/backfill.mjs';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');

function patchFor(data) {
  return data.membersPublic === undefined ? { membersPublic: true } : null;
}

async function main() {
  console.log(`${APPLY ? 'Backfilling' : 'DRY-RUN: checking'} membersPublic against ${projectId}`);
  await backfillCollection(db, 'organizations', db.collection('organizations'), patchFor, { apply: APPLY });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
