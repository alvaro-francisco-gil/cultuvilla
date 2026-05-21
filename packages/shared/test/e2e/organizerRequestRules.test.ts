// Firestore Rules e2e test for top-level /organizerRequests/{requestId}.
// Verifies: the requester (resource.data.userId == auth.uid) and app admins
// can read; other authenticated users and anonymous users cannot. No client
// can create/update/delete — those flows are owned by Cloud Functions via
// the admin SDK.
//
// Uses @firebase/rules-unit-testing to mount the live firestore.rules file
// against the firestore emulator and execute requests under different auth
// contexts.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;

const REQUEST_ID = 'req-1';
const REQUESTER = 'alice';
const OTHER_USER = 'bob';
const APP_ADMIN = 'sadmin';

async function seedOrganizerRequest() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `organizerRequests/${REQUEST_ID}`), {
      userId: REQUESTER,
      status: 'pending',
      createdAt: new Date(),
    });
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

describe('firestore.rules — /organizerRequests/{requestId}', () => {
  describe('read', () => {
    it('owner (resource.data.userId == auth.uid) can read their own organizerRequest', async () => {
      await seedOrganizerRequest();
      const aliceDb = env.authenticatedContext(REQUESTER).firestore();
      await assertSucceeds(getDoc(doc(aliceDb, `organizerRequests/${REQUEST_ID}`)));
    });

    it('app admin can read any organizerRequest', async () => {
      await seedOrganizerRequest();
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `admins/${APP_ADMIN}`), { createdAt: new Date() });
      });
      const adminDb = env.authenticatedContext(APP_ADMIN).firestore();
      await assertSucceeds(getDoc(doc(adminDb, `organizerRequests/${REQUEST_ID}`)));
    });

    it('an authenticated user cannot read someone else\'s organizerRequest', async () => {
      await seedOrganizerRequest();
      const bobDb = env.authenticatedContext(OTHER_USER).firestore();
      await assertFails(getDoc(doc(bobDb, `organizerRequests/${REQUEST_ID}`)));
    });

    it('anonymous user cannot read organizerRequests', async () => {
      await seedOrganizerRequest();
      const anon = env.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(anon, `organizerRequests/${REQUEST_ID}`)));
    });
  });

  describe('write (server-side only)', () => {
    it('the requester themselves cannot create an organizerRequest', async () => {
      const aliceDb = env.authenticatedContext(REQUESTER).firestore();
      await assertFails(
        setDoc(doc(aliceDb, `organizerRequests/${REQUEST_ID}`), {
          userId: REQUESTER,
          status: 'pending',
        }),
      );
    });

    it('an app admin cannot create an organizerRequest', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `admins/${APP_ADMIN}`), { createdAt: new Date() });
      });
      const adminDb = env.authenticatedContext(APP_ADMIN).firestore();
      await assertFails(
        setDoc(doc(adminDb, `organizerRequests/${REQUEST_ID}`), {
          userId: REQUESTER,
          status: 'pending',
        }),
      );
    });

    it('the requester cannot update their organizerRequest', async () => {
      await seedOrganizerRequest();
      const aliceDb = env.authenticatedContext(REQUESTER).firestore();
      await assertFails(
        updateDoc(doc(aliceDb, `organizerRequests/${REQUEST_ID}`), { status: 'approved' }),
      );
    });

    it('an app admin cannot update an organizerRequest', async () => {
      await seedOrganizerRequest();
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `admins/${APP_ADMIN}`), { createdAt: new Date() });
      });
      const adminDb = env.authenticatedContext(APP_ADMIN).firestore();
      await assertFails(
        updateDoc(doc(adminDb, `organizerRequests/${REQUEST_ID}`), { status: 'approved' }),
      );
    });

    it('the requester cannot delete their organizerRequest', async () => {
      await seedOrganizerRequest();
      const aliceDb = env.authenticatedContext(REQUESTER).firestore();
      await assertFails(
        deleteDoc(doc(aliceDb, `organizerRequests/${REQUEST_ID}`)),
      );
    });

    it('an app admin cannot delete an organizerRequest', async () => {
      await seedOrganizerRequest();
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `admins/${APP_ADMIN}`), { createdAt: new Date() });
      });
      const adminDb = env.authenticatedContext(APP_ADMIN).firestore();
      await assertFails(
        deleteDoc(doc(adminDb, `organizerRequests/${REQUEST_ID}`)),
      );
    });
  });
});
