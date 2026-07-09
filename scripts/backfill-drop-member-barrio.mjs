#!/usr/bin/env node
/**
 * backfill-drop-member-barrio.mjs
 *
 * Reverse of backfill-village-member-barrio.mjs. Residence barrio is now
 * single-source-of-truth on persons.municipalityLinks (the getPersonsByBarrio
 * query surface); the duplicated `member.barrioId` field is retired.
 *
 * For every village member doc that still has `barrioId`:
 *   1. Ensure the linked person's municipalityLinks REFLECTS residence for this
 *      municipality. The syncMemberBarrioToResidence trigger kept them in sync,
 *      so normally the person already has the (validated) link and we trust it.
 *      Only if the person has NO link for this municipality do we reconcile —
 *      copy member.barrioId into a fresh link so residence isn't lost.
 *   2. Delete `member.barrioId` (FieldValue.delete()).
 *
 * The person value is authoritative: the trigger normalized non-approved barrios
 * to null, so we never overwrite an existing person link with a stale member
 * value — we only fill a MISSING one.
 *
 * USAGE
 *   node scripts/backfill-drop-member-barrio.mjs
 *
 * Idempotent: members without `barrioId` are skipped; run again safely. Scoped
 * to municipalities/{}/members (org members are left alone). Dev only.
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
  // Prefetch persons → map userId -> { ref, links }, so we don't query per member.
  const personsSnap = await db.collection('persons').get();
  const personByUser = new Map();
  for (const p of personsSnap.docs) {
    const uid = p.data().userId;
    if (typeof uid === 'string' && uid.length > 0) {
      personByUser.set(uid, {
        ref: p.ref,
        links: Array.isArray(p.data().municipalityLinks) ? p.data().municipalityLinks : [],
      });
    }
  }
  console.log(`Indexed ${personByUser.size} account-linked persons.`);

  const snap = await db.collectionGroup('members').get();
  console.log(`Scanned ${snap.size} 'members' docs (village + org).`);

  let cleared = 0;
  let reconciled = 0;
  let noField = 0;
  let skippedOrg = 0;
  let orphanMembers = 0;
  let batch = db.batch();
  let inBatch = 0;

  const flush = async () => {
    if (inBatch > 0) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  };

  for (const doc of snap.docs) {
    if (!isVillageMember(doc.ref)) {
      skippedOrg++;
      continue;
    }
    if (doc.data().barrioId === undefined) {
      noField++;
      continue;
    }

    const municipalityId = doc.ref.parent.parent.id;
    const uid = doc.id;
    const memberBarrio = doc.data().barrioId ?? null;
    const person = personByUser.get(uid);

    if (person) {
      const hasLink = person.links.some((l) => l && l.municipalityId === municipalityId);
      if (!hasLink) {
        // Residence would be lost — fill the missing link from the member value.
        const nextLinks = [...person.links, { municipalityId, barrioId: memberBarrio }];
        batch.update(person.ref, { municipalityLinks: nextLinks });
        person.links = nextLinks; // keep the in-memory index consistent
        reconciled++;
        inBatch++;
      }
    } else {
      // A member with a barrio but no account-linked person: nothing to preserve.
      orphanMembers++;
    }

    batch.update(doc.ref, { barrioId: admin.firestore.FieldValue.delete() });
    cleared++;
    inBatch++;

    if (inBatch >= 400) await flush();
  }
  await flush();

  console.log('\nDone.');
  console.log(`  Org members skipped:        ${skippedOrg}`);
  console.log(`  No barrioId (already done): ${noField}`);
  console.log(`  Person links reconciled:    ${reconciled}`);
  console.log(`  Orphan members (no person): ${orphanMembers}`);
  console.log(`  member.barrioId cleared:    ${cleared}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
