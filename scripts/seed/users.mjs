#!/usr/bin/env node
/**
 * Seed users: Auth account + `users/{uid}` + optional `persons/{id}` persona +
 * optional `admins/{uid}` superadmin marker. Uploads each user's `photo` to
 * `users/{uid}/photo/` and wires it into `photoURL`.
 *
 *   DATASET=demo_1 pnpm seed:dev:users
 *   DATASET=demo_1 pnpm seed:dev:users:wipe
 */

import { buildPersonData, buildUserData } from '@cultuvilla/shared/models';

import { WIPE, auth, db, tag } from './lib/context.mjs';
import { loadDataset } from './lib/dataset.mjs';
import { uploadImage, wipeStorageFolder } from './lib/images.mjs';
import { personDocId } from './lib/ids.mjs';
import { runAsMain } from './lib/run.mjs';

export async function seedUsers(dataset) {
  for (const u of dataset.users) {
    let authUser;
    try {
      authUser = await auth.getUserByEmail(u.email);
      console.log(`[seed] user ${u.email} reused (${authUser.uid})`);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
      authUser = await auth.createUser({
        email: u.email,
        password: u.password,
        displayName: u.displayName,
        emailVerified: true,
      });
      console.log(`[seed] user ${u.email} created (${authUser.uid})`);
    }

    if (u.photo) {
      const url = await uploadImage(u.photo, `users/${authUser.uid}/photo`);
      if (authUser.photoURL !== url) {
        await auth.updateUser(authUser.uid, { photoURL: url });
        console.log(`[seed]   photoURL set for ${u.email}`);
      }
    }

    // Create persona first when present so the syncPersonDenormalization
    // trigger has a person to project from. We also write users.personId
    // explicitly so the app links them without waiting on the trigger.
    let personId = null;
    if (u.person) {
      personId = personDocId(u.ref);
      await db.collection('persons').doc(personId).set(
        tag(
          buildPersonData({
            givenName: u.person.givenName,
            middleNames: u.person.middleNames ?? [],
            firstSurname: u.person.firstSurname ?? null,
            secondSurname: u.person.secondSurname ?? null,
            nickname: u.person.nickname ?? null,
            sex: u.person.sex ?? null,
            birthday: u.person.birthday ?? null,
            deathDate: u.person.deathDate ?? null,
            birthPlace: u.person.birthPlace ?? null,
            burialPlace: u.person.burialPlace ?? null,
            municipalityLinks: u.person.municipalityLinks ?? [],
            occupationIds: u.person.occupationIds ?? [],
            pendingOccupations: u.person.pendingOccupations ?? [],
            biography: u.person.biography ?? null,
            photoURL: u.person.photoURL ?? null,
            userId: authUser.uid,
            createdBy: authUser.uid,
          }),
        ),
        { merge: true },
      );
      console.log(`[seed]   persons/${personId} ✓`);
    }

    await db.collection('users').doc(authUser.uid).set(
      tag(buildUserData({ displayName: u.displayName, email: u.email, personId })),
      { merge: true },
    );

    if (u.isAppAdmin) {
      await db.collection('admins').doc(authUser.uid).set(tag({ createdAt: new Date() }), { merge: true });
      console.log(`[seed]   admins/${authUser.uid} ✓`);
    }
  }
}

export async function wipeUsers(dataset) {
  let docs = 0;
  let storage = 0;
  for (const u of dataset.users) {
    // Person doc wiped by deterministic ID regardless of Auth state.
    if (u.person) {
      await db.collection('persons').doc(personDocId(u.ref)).delete().catch(() => {});
      docs++;
    }
    try {
      const authUser = await auth.getUserByEmail(u.email);
      storage += await wipeStorageFolder(`users/${authUser.uid}/photo/`);
      await db.collection('admins').doc(authUser.uid).delete().catch(() => {});
      await db.collection('users').doc(authUser.uid).delete().catch(() => {});
      await auth.deleteUser(authUser.uid).catch(() => {});
      docs += 2;
      console.log(`[wipe] user ${u.email} (${authUser.uid}) ✓`);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') console.warn(`[wipe] user ${u.email}: ${err.message}`);
    }
  }
  console.log(`[wipe] users: ${docs} doc(s) + ${storage} storage file(s) removed.`);
}

export async function run({ wipe = WIPE } = {}) {
  const dataset = await loadDataset();
  if (wipe) await wipeUsers(dataset);
  else await seedUsers(dataset);
}

runAsMain(import.meta.url, run);
