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
 *   node scripts/backfill-org-member-roles.mjs          (dry run — no writes)
 *   node scripts/backfill-org-member-roles.mjs --apply  (writes to Firestore)
 *
 * Idempotent: skips any member doc that already has a `role` field set.
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

  let toAdmin = 0;
  let toMember = 0;
  let alreadyMigrated = 0;

  for (const org of orgs.docs) {
    const requestedBy = org.get('requestedBy');
    const members = await org.ref.collection('members').get();

    for (const m of members.docs) {
      if (m.get('role')) {
        alreadyMigrated++;
        continue; // already migrated — idempotent skip
      }
      const role = m.id === requestedBy ? 'admin' : 'member';
      if (role === 'admin') toAdmin++; else toMember++;
      if (APPLY) await m.ref.set({ role }, { merge: true });
    }
  }

  console.log(`\n${APPLY ? 'WROTE' : 'DRY-RUN'}: ${toAdmin} admins, ${toMember} members`);
  console.log(`  Already migrated (skipped): ${alreadyMigrated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
