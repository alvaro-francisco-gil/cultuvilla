#!/usr/bin/env node
/**
 * Seed the Firebase emulator with the deterministic E2E fixture set.
 *
 * Standalone — it does NOT go through the demo-dataset domain seeders, so the
 * E2E substrate stays isolated from the dev-seed path. But it builds every doc
 * via the SAME production model builders (`@cultuvilla/shared/models`), so the
 * fixtures can't drift from the schema the strict converters enforce (D5).
 *
 * Refuses to run unless the emulator env vars are set (context.mjs will not
 * touch the real dev project). Run via `pnpm seed:e2e` after `pnpm shared:build`.
 */
import { db, auth, GeoPoint, EMULATOR } from './lib/context.mjs';
import {
  buildUserData,
  buildPersonData,
  buildMunicipalityData,
  buildVillageCommunity,
  buildVillageMemberData,
  buildOrganizationData,
  buildOrgMemberData,
  buildEventData,
  buildLocationData,
} from '@cultuvilla/shared/models';
import { E2E_PASSWORD, users, village, org, event } from '../data/seed-fixtures/e2e/fixtures.mjs';

if (!EMULATOR) {
  console.error(
    '[seed:e2e] Emulator env not detected. Set FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST\n' +
      '           (the web-e2e CI job does this) — this seeder never targets the real project.',
  );
  process.exit(1);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Create the Auth user with a deterministic uid, or update it if it exists. */
async function upsertUser({ uid, email, displayName }) {
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password: E2E_PASSWORD, displayName, emailVerified: true });
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      await auth.createUser({ uid, email, password: E2E_PASSWORD, displayName, emailVerified: true });
    } else {
      throw err;
    }
  }
}

async function run() {
  // Auth accounts + persons/{id} + users/{uid} profile docs. The person is
  // linked via personId so the app treats the user as onboarded (otherwise the
  // register FAB never renders — it diverts to complete-profile).
  for (const u of [users.admin, users.attendee]) {
    await upsertUser(u);
    await db
      .collection('persons')
      .doc(u.personId)
      .set(
        buildPersonData({
          givenName: u.givenName,
          firstSurname: u.firstSurname,
          createdBy: u.uid,
          userId: u.uid,
        }),
        { merge: true },
      );
    await db
      .collection('users')
      .doc(u.uid)
      .set(buildUserData({ displayName: u.displayName, email: u.email, personId: u.personId }), {
        merge: true,
      });
  }

  // Activated village = municipality doc + community overlay + members
  const coords = new GeoPoint(village.coordinates.lat, village.coordinates.lng);
  await db
    .collection('municipalities')
    .doc(village.docId)
    .set(
      {
        ...buildMunicipalityData({
          name: village.name,
          province: village.province,
          comunidadAutonoma: village.comunidadAutonoma,
          codigoINE: village.codigoINE,
          coordinates: coords,
        }),
        community: buildVillageCommunity({
          description: village.description,
          adminUserId: users.admin.uid,
        }),
        communityActive: true,
      },
      { merge: true },
    );
  const members = db.collection('municipalities').doc(village.docId).collection('members');
  await members
    .doc(users.admin.uid)
    .set(buildVillageMemberData({ userId: users.admin.uid, role: 'admin' }), { merge: true });
  await members
    .doc(users.attendee.uid)
    .set(buildVillageMemberData({ userId: users.attendee.uid, role: 'user' }), { merge: true });

  // Approved organization + founding admin member. approveOrganization writes
  // the member in prod; the demo org seeder omits it, so seed it here directly.
  await db
    .collection('organizations')
    .doc(org.docId)
    .set(
      buildOrganizationData({
        name: org.name,
        type: org.type,
        description: org.description,
        municipalityId: village.docId,
        requestedBy: users.admin.uid,
        status: 'approved',
        reviewedBy: users.admin.uid,
        reviewedAt: new Date(),
      }),
      { merge: true },
    );
  await db
    .collection('organizations')
    .doc(org.docId)
    .collection('members')
    .doc(users.admin.uid)
    .set(buildOrgMemberData({ role: 'admin' }), { merge: true });

  // Upcoming published event in the village
  const startDate = new Date(Date.now() + event.startOffsetDays * DAY_MS);
  await db
    .collection('events')
    .doc(event.docId)
    .set(
      buildEventData({
        title: event.title,
        description: event.description,
        startDate,
        location: buildLocationData({
          coordinates: village.coordinates,
          displayName: `Plaza Mayor, ${village.name}`,
        }),
        maxAttendees: event.maxAttendees,
        telephoneRequired: false,
        status: event.status,
        organizerUserIds: [users.admin.uid],
        organizerOrgIds: [org.docId],
        createdBy: users.admin.uid,
        municipalityId: village.docId,
        villageName: village.name,
        villageCoordinates: coords,
      }),
      { merge: true },
    );

  console.log(
    `[seed:e2e] seeded emulator (users=${users.admin.uid},${users.attendee.uid} ` +
      `village=${village.docId} org=${org.docId} event=${event.docId})`,
  );
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed:e2e] failed:', err);
    process.exit(1);
  });
