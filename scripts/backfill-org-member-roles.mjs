#!/usr/bin/env node
/**
 * backfill-org-member-roles.mjs
 *
 * One-off: `OrgMemberDataSchema.role` was added after some org-member docs
 * already existed. Those docs lack the field. This script backfills it:
 *   - the member whose uid matches the parent org's `requestedBy` field → 'admin'
 *   - every other member → 'member'
 *
 * USAGE
 *   node scripts/backfill-org-member-roles.mjs                 (dev dry run)
 *   node scripts/backfill-org-member-roles.mjs --apply         (dev writes)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-org-member-roles.mjs --env=beta --confirm --apply
 *
 * Credentials resolve via initAdminForEnv (see lib/env-credentials.mjs). Dev is
 * autonomous; beta/prod require --confirm (and the stored ADC — unset
 * GOOGLE_APPLICATION_CREDENTIALS so a dev key can't hijack the target project).
 * `--apply` still gates the actual write on every env (dry run without it).
 *
 * Idempotent: skips any member doc that already has a `role` field set.
 */

import { initAdminForEnv } from './lib/env-credentials.mjs';
import { parseEnvConfirm } from './lib/env-confirm.mjs';
import { backfillCollection } from './lib/backfill.mjs';
import admin from 'firebase-admin';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`${APPLY ? 'Backfilling' : 'DRY-RUN: checking'} org member roles against ${projectId}`);

  const orgs = await db.collection('organizations').get();
  let toAdmin = 0;
  let toMember = 0;

  for (const org of orgs.docs) {
    const requestedBy = org.get('requestedBy');
    await backfillCollection(
      db,
      `organizations/${org.id}/members`,
      org.ref.collection('members'),
      (data, docSnap) => {
        if (data.role) return null; // already migrated
        const role = docSnap.id === requestedBy ? 'admin' : 'member';
        if (role === 'admin') toAdmin++; else toMember++;
        return { role };
      },
      { apply: APPLY },
    );
  }

  console.log(`\n${APPLY ? 'WROTE' : 'WOULD WRITE'}: ${toAdmin} admins, ${toMember} members`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
