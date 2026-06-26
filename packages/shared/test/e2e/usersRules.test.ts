// Firestore Rules e2e test for /users/{userId}.
// Verifies the onboarding write path, including the documented race where the
// syncPersonDenormalization Cloud Function (admin SDK) pre-creates the user doc
// carrying only `displayName` before the client's createUserProfile runs.
//
// Uses @firebase/rules-unit-testing to mount the live firestore.rules file
// against the firestore emulator and execute requests under different auth
// contexts.
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;

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
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `users/${userId}`), { displayName: 'Ana' });
  });
}

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: process.env.TEST_PROJECT_ID || 'cultuvilla-rules-test',
    firestore: { rules },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

describe('firestore.rules — /users/{userId}', () => {
  describe('create (no pre-existing doc)', () => {
    it('owner can create their own profile', async () => {
      const ownerDb = env.authenticatedContext(OWNER).firestore();
      await assertSucceeds(
        setDoc(doc(ownerDb, `users/${OWNER}`), createUserProfilePayload(), { merge: true }),
      );
    });

    it('cannot create a profile for another user', async () => {
      const ownerDb = env.authenticatedContext(OWNER).firestore();
      await assertFails(
        setDoc(doc(ownerDb, `users/${OTHER}`), createUserProfilePayload(), { merge: true }),
      );
    });
  });

  describe('onboarding race: trigger created the doc first', () => {
    it('owner can merge createUserProfile payload onto a trigger-created doc', async () => {
      // syncPersonDenormalization wrote { displayName } first.
      await seedTriggerCreatedUserDoc(OWNER);
      const ownerDb = env.authenticatedContext(OWNER).firestore();
      // createUserProfile uses setDoc(merge); because the doc exists this is an
      // UPDATE, and the payload carries `createdAt`. This is the real onboarding
      // write and must be allowed.
      await assertSucceeds(
        setDoc(doc(ownerDb, `users/${OWNER}`), createUserProfilePayload(), { merge: true }),
      );
    });

    it('still blocks a client from writing displayName itself', async () => {
      const ownerDb = env.authenticatedContext(OWNER).firestore();
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
      const ownerDb = env.authenticatedContext(OWNER).firestore();
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
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `users/${OWNER}`), {
          ...createUserProfilePayload(),
          displayName: 'Ana',
          createdAt: new Date(),
        });
      });
      const ownerDb = env.authenticatedContext(OWNER).firestore();
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
