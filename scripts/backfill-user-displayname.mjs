#!/usr/bin/env node
/**
 * backfill-user-displayname.mjs
 *
 * One-time backfill for the displayName denormalization introduced in
 * functions/src/users/syncPersonDenormalization.ts.
 *
 * For every persons/{personId} doc that has a userId, recompute the
 * displayName projection and set it on users/{userId}. Runs idempotently:
 * docs whose displayName already matches are skipped.
 *
 * USAGE
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/villa-events-sa.json \
 *   node scripts/backfill-user-displayname.mjs
 *
 *   Add `--dry-run` to count + log without writing.
 *
 * SAFETY
 *   Project-pinned to villa-events (dev). To run against beta/prod, edit the
 *   guard explicitly; we don't auto-detect.
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'villa-events';
const DRY_RUN = process.argv.includes('--dry-run');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('[backfill] GOOGLE_APPLICATION_CREDENTIALS not set.');
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
if (admin.app().options.projectId !== PROJECT_ID) {
  console.error(`[backfill] Refusing project "${admin.app().options.projectId}". Dev-only.`);
  process.exit(1);
}

function projectName(person) {
  const parts = [];
  if (typeof person.givenName === 'string' && person.givenName.length > 0) parts.push(person.givenName);
  if (Array.isArray(person.middleNames)) {
    for (const m of person.middleNames) if (typeof m === 'string' && m.length > 0) parts.push(m);
  }
  if (typeof person.firstSurname === 'string' && person.firstSurname.length > 0) parts.push(person.firstSurname);
  if (typeof person.secondSurname === 'string' && person.secondSurname.length > 0) parts.push(person.secondSurname);
  return parts.join(' ');
}

const stats = { scanned: 0, updated: 0, skipped: 0, noUser: 0, missing: 0 };

const persons = await db.collection('persons').get();
stats.scanned = persons.size;
console.log(`[backfill] scanning ${persons.size} person doc(s)…`);

for (let i = 0; i < persons.docs.length; i += 400) {
  const chunk = persons.docs.slice(i, i + 400);
  const batch = db.batch();
  let writes = 0;

  for (const personDoc of chunk) {
    const person = personDoc.data();
    if (!person.userId) {
      stats.noUser++;
      continue;
    }
    const name = projectName(person);
    const userRef = db.doc(`users/${person.userId}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      // Skip — never create a partial user doc here. If the person was left
      // orphaned by a wipe or cleanup, the user has to sign up again; the
      // trigger will then populate displayName on the next person write.
      stats.missing++;
      console.log(`[backfill]   persons/${personDoc.id} → users/${person.userId} missing — skipped`);
      continue;
    }
    if (userSnap.get('displayName') === name) {
      stats.skipped++;
      continue;
    }
    if (!DRY_RUN) batch.update(userRef, { displayName: name });
    writes++;
    stats.updated++;
  }

  if (!DRY_RUN && writes > 0) await batch.commit();
}

console.log(
  `[backfill] done${DRY_RUN ? ' (dry-run)' : ''}. ` +
    `scanned=${stats.scanned} updated=${stats.updated} skipped=${stats.skipped} ` +
    `no-userId=${stats.noUser} user-missing=${stats.missing}`,
);
