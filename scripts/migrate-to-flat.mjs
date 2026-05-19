#!/usr/bin/env node
// One-shot migration: nested villages/{vid}/{events,organizations} -> top-level.
// Usage: node scripts/migrate-to-flat.mjs --project villa-events --commit
// Without --commit, it runs as a dry run (logs only).

import admin from 'firebase-admin';

const args = process.argv.slice(2);
const projectArg = args.includes('--project') ? args[args.indexOf('--project') + 1] : null;
const commit = args.includes('--commit');

if (!projectArg) {
  console.error('Missing --project <projectId>');
  process.exit(1);
}

admin.initializeApp({ projectId: projectArg });
const db = admin.firestore();

async function main() {
  console.log(`[migrate] project=${projectArg} commit=${commit}`);
  const villagesSnap = await db.collection('villages').get();
  console.log(`[migrate] found ${villagesSnap.size} villages`);

  let orgCount = 0, orgMemberCount = 0, eventCount = 0, regCount = 0, errors = 0;

  for (const villageDoc of villagesSnap.docs) {
    const vid = villageDoc.id;
    const village = villageDoc.data();
    const villageName = village.name ?? '';
    const villageImages = Array.isArray(village.images) ? village.images : [];
    const villageCover = villageImages.length > 0 ? villageImages[0] : null;
    const villageCoords = village.coordinates ?? null;

    // -- ORGANIZATIONS --
    const nestedOrgsSnap = await db.collection('villages').doc(vid).collection('organizations').get();
    for (const orgDoc of nestedOrgsSnap.docs) {
      try {
        const oid = orgDoc.id;
        const orgData = orgDoc.data();
        const flatRef = db.collection('organizations').doc(oid);
        const flatExists = (await flatRef.get()).exists;

        if (!flatExists) {
          const newDoc = {
            ...orgData,
            villageId: vid,
            approvedBy: orgData.approvedBy ?? null,
            decidedAt: orgData.decidedAt ?? null,
          };
          if (commit) await flatRef.set(newDoc);
          console.log(`[org] ${vid}/${oid} -> organizations/${oid}`);
          orgCount++;
        } else {
          console.log(`[org] ${vid}/${oid} already exists at top-level, skipping`);
        }

        // org members
        const orgMembersSnap = await orgDoc.ref.collection('members').get();
        for (const memberDoc of orgMembersSnap.docs) {
          const flatMemberRef = flatRef.collection('members').doc(memberDoc.id);
          const flatMemberExists = (await flatMemberRef.get()).exists;
          if (!flatMemberExists) {
            if (commit) await flatMemberRef.set(memberDoc.data());
            console.log(`[org-member] ${vid}/${oid}/${memberDoc.id}`);
            orgMemberCount++;
          }
        }
      } catch (err) {
        console.error(`[error] org ${vid}/${orgDoc.id}:`, err.message);
        errors++;
      }
    }

    // -- EVENTS --
    const nestedEventsSnap = await db.collection('villages').doc(vid).collection('events').get();
    for (const eventDoc of nestedEventsSnap.docs) {
      try {
        const eid = eventDoc.id;
        const eventData = eventDoc.data();
        const flatRef = db.collection('events').doc(eid);
        const flatExists = (await flatRef.get()).exists;

        if (!flatExists) {
          const newDoc = {
            ...eventData,
            villageId: vid,
            villageName,
            villageCoverImage: villageCover,
            villageCoordinates: villageCoords,
          };
          if (commit) await flatRef.set(newDoc);
          console.log(`[event] ${vid}/${eid} -> events/${eid}`);
          eventCount++;
        } else {
          console.log(`[event] ${vid}/${eid} already at top-level, skipping`);
        }

        // registrations
        const regsSnap = await eventDoc.ref.collection('registrations').get();
        for (const regDoc of regsSnap.docs) {
          const flatRegRef = flatRef.collection('registrations').doc(regDoc.id);
          const flatRegExists = (await flatRegRef.get()).exists;
          if (!flatRegExists) {
            if (commit) await flatRegRef.set(regDoc.data());
            console.log(`[reg] ${vid}/${eid}/${regDoc.id}`);
            regCount++;
          }
        }
      } catch (err) {
        console.error(`[error] event ${vid}/${eventDoc.id}:`, err.message);
        errors++;
      }
    }
  }

  console.log(`[migrate] DONE — orgs=${orgCount} orgMembers=${orgMemberCount} events=${eventCount} regs=${regCount} errors=${errors} (commit=${commit})`);

  if (errors > 0) {
    console.error(`[migrate] ${errors} document(s) failed. Re-run to retry (script is idempotent).`);
    process.exit(1);
  }

  if (!commit) {
    console.log(`[migrate] Dry run. Re-run with --commit to write.`);
  } else {
    console.log(`[migrate] WROTE to top-level. Old nested docs are STILL THERE. Verify, then run Task 25 to remove.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
