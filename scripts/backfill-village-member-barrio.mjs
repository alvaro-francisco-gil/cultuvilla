#!/usr/bin/env node
/**
 * backfill-village-member-barrio.mjs
 *
 * One-off: `VillageMemberDataSchema.barrioId` was added as the editable source
 * of truth for an account-holder's residence barrio (the syncMemberBarrioToResidence
 * trigger projects it into person.municipalityLinks). Existing member docs lack
 * the field. Seed it from the user's CURRENT residence: the person linked to the
 * member (persons.userId == uid), taking the barrioId of that person's
 * municipalityLinks entry for this municipality (else null).
 *
 * After this runs, member.barrioId and person.municipalityLinks agree, so the
 * trigger's idempotency check makes subsequent membership writes no-ops until a
 * barrio actually changes.
 *
 * USAGE
 *   node scripts/backfill-village-member-barrio.mjs
 *
 * Idempotent: only patches village-member docs whose `barrioId` is still
 * undefined. Scoped to municipalities/{}/members (org members are left alone).
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

/** True for docs at municipalities/{id}/members/{uid} (not organizations/{id}/members/{uid}). */
function isVillageMember(docRef) {
  return docRef.parent.parent?.parent?.id === 'municipalities';
}

async function main() {
  // Prefetch persons → map userId -> municipalityLinks, so we don't query per member.
  const personsSnap = await db.collection('persons').get();
  const linksByUser = new Map();
  for (const p of personsSnap.docs) {
    const uid = p.data().userId;
    if (typeof uid === 'string' && uid.length > 0) {
      linksByUser.set(uid, Array.isArray(p.data().municipalityLinks) ? p.data().municipalityLinks : []);
    }
  }
  console.log(`Indexed ${linksByUser.size} account-linked persons.`);

  const snap = await db.collectionGroup('members').get();
  console.log(`Scanned ${snap.size} 'members' docs (village + org).`);

  let patched = 0;
  let alreadyCorrect = 0;
  let skippedOrg = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const doc of snap.docs) {
    if (!isVillageMember(doc.ref)) {
      skippedOrg++;
      continue;
    }
    if (doc.data().barrioId !== undefined) {
      alreadyCorrect++;
      continue;
    }
    const municipalityId = doc.ref.parent.parent.id;
    const uid = doc.id;
    const links = linksByUser.get(uid) ?? [];
    const link = links.find((l) => l && l.municipalityId === municipalityId);
    const barrioId = link ? (link.barrioId ?? null) : null;

    batch.update(doc.ref, { barrioId });
    patched++;
    inBatch++;
    if (inBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();

  console.log('\nDone.');
  console.log(`  Org members skipped:     ${skippedOrg}`);
  console.log(`  Village already correct: ${alreadyCorrect}`);
  console.log(`  Village patched:         ${patched}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
