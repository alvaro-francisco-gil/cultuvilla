// Firestore Rules e2e test for /users/{userId}.
// Verifies the onboarding write path, including the documented race where the
// syncPersonDenormalization Cloud Function (admin SDK) pre-creates the user doc
// carrying only `displayName` before the client's createUserProfile runs.
//
// Uses @firebase/rules-unit-testing to mount the live firestore.rules file
// against the firestore emulator and execute requests under different auth
// contexts.
import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

const OWNER = 'uid-1';
const OTHER = 'uid-2';

// Mirrors the merge payload written by createUserProfile() in
// packages/shared/src/services/userService.ts — note it always includes
// `createdAt` (the converter is bypassed so the schema-required field is set
// explicitly).
const createUserProfilePayload = () => ({
  email: 'ana@example.com',
  telephone: null,
  activeMunicipalityId: null,
  personId: 'p1',
  createdAt: serverTimestamp(),
});

// Simulates syncPersonDenormalization writing users/{uid} first with only
// displayName (admin SDK bypasses rules).
async function seedTriggerCreatedUserDoc(userId: string) {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `users/${userId}`), { displayName: 'Ana' });
  });
}

describe('firestore.rules — /users/{userId}', () => {
  describe('create (no pre-existing doc)', () => {
    it('owner can create their own profile', async () => {
      const ownerDb = asUser(getEnv(), OWNER);
      await assertSucceeds(
        setDoc(doc(ownerDb, `users/${OWNER}`), createUserProfilePayload(), { merge: true }),
      );
    });

    it('cannot create a profile for another user', async () => {
      const ownerDb = asUser(getEnv(), OWNER);
      await assertFails(
        setDoc(doc(ownerDb, `users/${OTHER}`), createUserProfilePayload(), { merge: true }),
      );
    });
  });

  describe('onboarding race: trigger created the doc first', () => {
    it('owner can merge createUserProfile payload onto a trigger-created doc', async () => {
      // syncPersonDenormalization wrote { displayName } first.
      await seedTriggerCreatedUserDoc(OWNER);
      const ownerDb = asUser(getEnv(), OWNER);
      // createUserProfile uses setDoc(merge); because the doc exists this is an
      // UPDATE, and the payload carries `createdAt`. This is the real onboarding
      // write and must be allowed.
      await assertSucceeds(
        setDoc(doc(ownerDb, `users/${OWNER}`), createUserProfilePayload(), { merge: true }),
      );
    });

    it('still blocks a client from writing displayName itself', async () => {
      const ownerDb = asUser(getEnv(), OWNER);
      await assertFails(
        setDoc(
          doc(ownerDb, `users/${OWNER}`),
          { ...createUserProfilePayload(), displayName: 'Hacked Name' },
          { merge: true },
        ),
      );
    });

    it('blocks overwriting displayName even when merging onto the stub', async () => {
      await seedTriggerCreatedUserDoc(OWNER);
      const ownerDb = asUser(getEnv(), OWNER);
      await assertFails(
        setDoc(
          doc(ownerDb, `users/${OWNER}`),
          { ...createUserProfilePayload(), displayName: 'Hacked Name' },
          { merge: true },
        ),
      );
    });
  });

  describe('createdAt immutability', () => {
    it('blocks resetting createdAt on a fully-formed profile', async () => {
      await seed(getEnv(), async (ctx) => {
        await setDoc(doc(ctx.firestore(), `users/${OWNER}`), {
          ...createUserProfilePayload(),
          displayName: 'Ana',
          createdAt: new Date(),
        });
      });
      const ownerDb = asUser(getEnv(), OWNER);
      await assertFails(
        setDoc(
          doc(ownerDb, `users/${OWNER}`),
          { createdAt: serverTimestamp() },
          { merge: true },
        ),
      );
    });
  });
});
