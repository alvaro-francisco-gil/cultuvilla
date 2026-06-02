// Firestore Rules e2e test for /municipalities/{mid}/joinRequests/{userId}.
// Verifies: the requester (owner), village admins, and app admins can read;
// other authenticated users and anonymous users cannot. No client can
// create/update/delete — those flows are owned by Cloud Functions via the
// admin SDK.
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
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;

const MID = 'salamanca';
const REQUESTER = 'alice';
const OTHER_USER = 'bob';
const VILLAGE_ADMIN = 'vadmin';
const APP_ADMIN = 'sadmin';

async function seedJoinRequest() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${MID}`), { name: 'Salamanca' });
    await setDoc(doc(ctx.firestore(), `municipalities/${MID}/joinRequests/${REQUESTER}`), {
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

describe('firestore.rules — /municipalities/{mid}/joinRequests/{userId}', () => {
  describe('read', () => {
    it('owner can read their own joinRequest', async () => {
      await seedJoinRequest();
      const aliceDb = env.authenticatedContext(REQUESTER).firestore();
      await assertSucceeds(
        getDoc(doc(aliceDb, `municipalities/${MID}/joinRequests/${REQUESTER}`)),
      );
    });

    it('village admin can read joinRequests in their municipality', async () => {
      await seedJoinRequest();
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), `municipalities/${MID}/members/${VILLAGE_ADMIN}`),
          { role: 'admin' },
        );
      });
      const vadminDb = env.authenticatedContext(VILLAGE_ADMIN).firestore();
      await assertSucceeds(
        getDoc(doc(vadminDb, `municipalities/${MID}/joinRequests/${REQUESTER}`)),
      );
    });

    it('app admin can read joinRequests', async () => {
      await seedJoinRequest();
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `admins/${APP_ADMIN}`), { createdAt: new Date() });
      });
      const adminDb = env.authenticatedContext(APP_ADMIN).firestore();
      await assertSucceeds(
        getDoc(doc(adminDb, `municipalities/${MID}/joinRequests/${REQUESTER}`)),
      );
    });

    it('a random authenticated user cannot read someone else\'s joinRequest', async () => {
      await seedJoinRequest();
      const bobDb = env.authenticatedContext(OTHER_USER).firestore();
      await assertFails(
        getDoc(doc(bobDb, `municipalities/${MID}/joinRequests/${REQUESTER}`)),
      );
    });

    it('anonymous user cannot read joinRequests', async () => {
      await seedJoinRequest();
      const anon = env.unauthenticatedContext().firestore();
      await assertFails(
        getDoc(doc(anon, `municipalities/${MID}/joinRequests/${REQUESTER}`)),
      );
    });
  });

  describe('write (server-side only)', () => {
    it('the requester themselves cannot create their own joinRequest', async () => {
      const aliceDb = env.authenticatedContext(REQUESTER).firestore();
      await assertFails(
        setDoc(doc(aliceDb, `municipalities/${MID}/joinRequests/${REQUESTER}`), {
          userId: REQUESTER,
          status: 'pending',
        }),
      );
    });

    it('a village admin cannot create a joinRequest', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), `municipalities/${MID}/members/${VILLAGE_ADMIN}`),
          { role: 'admin' },
        );
      });
      const vadminDb = env.authenticatedContext(VILLAGE_ADMIN).firestore();
      await assertFails(
        setDoc(doc(vadminDb, `municipalities/${MID}/joinRequests/${REQUESTER}`), {
          userId: REQUESTER,
          status: 'pending',
        }),
      );
    });

    it('an app admin cannot create a joinRequest', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `admins/${APP_ADMIN}`), { createdAt: new Date() });
      });
      const adminDb = env.authenticatedContext(APP_ADMIN).firestore();
      await assertFails(
        setDoc(doc(adminDb, `municipalities/${MID}/joinRequests/${REQUESTER}`), {
          userId: REQUESTER,
          status: 'pending',
        }),
      );
    });

    it('the requester cannot update their joinRequest', async () => {
      await seedJoinRequest();
      const aliceDb = env.authenticatedContext(REQUESTER).firestore();
      await assertFails(
        updateDoc(doc(aliceDb, `municipalities/${MID}/joinRequests/${REQUESTER}`), {
          status: 'approved',
        }),
      );
    });

    it('a village admin cannot update a joinRequest', async () => {
      await seedJoinRequest();
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), `municipalities/${MID}/members/${VILLAGE_ADMIN}`),
          { role: 'admin' },
        );
      });
      const vadminDb = env.authenticatedContext(VILLAGE_ADMIN).firestore();
      await assertFails(
        updateDoc(doc(vadminDb, `municipalities/${MID}/joinRequests/${REQUESTER}`), {
          status: 'approved',
        }),
      );
    });

    it('an app admin cannot update a joinRequest', async () => {
      await seedJoinRequest();
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `admins/${APP_ADMIN}`), { createdAt: new Date() });
      });
      const adminDb = env.authenticatedContext(APP_ADMIN).firestore();
      await assertFails(
        updateDoc(doc(adminDb, `municipalities/${MID}/joinRequests/${REQUESTER}`), {
          status: 'approved',
        }),
      );
    });

    it('the requester cannot delete their joinRequest', async () => {
      await seedJoinRequest();
      const aliceDb = env.authenticatedContext(REQUESTER).firestore();
      await assertFails(
        deleteDoc(doc(aliceDb, `municipalities/${MID}/joinRequests/${REQUESTER}`)),
      );
    });

    it('a village admin cannot delete a joinRequest', async () => {
      await seedJoinRequest();
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), `municipalities/${MID}/members/${VILLAGE_ADMIN}`),
          { role: 'admin' },
        );
      });
      const vadminDb = env.authenticatedContext(VILLAGE_ADMIN).firestore();
      await assertFails(
        deleteDoc(doc(vadminDb, `municipalities/${MID}/joinRequests/${REQUESTER}`)),
      );
    });

    it('an app admin cannot delete a joinRequest', async () => {
      await seedJoinRequest();
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `admins/${APP_ADMIN}`), { createdAt: new Date() });
      });
      const adminDb = env.authenticatedContext(APP_ADMIN).firestore();
      await assertFails(
        deleteDoc(doc(adminDb, `municipalities/${MID}/joinRequests/${REQUESTER}`)),
      );
    });
  });
});

describe('firestore.rules — joinRequests collection-group self-list', () => {
  async function seedMultiMuniJoinRequests() {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'municipalities/m1'), { name: 'Municipio1' });
      await setDoc(doc(db, 'municipalities/m2'), { name: 'Municipio2' });
      await setDoc(doc(db, 'municipalities/m1/joinRequests/alice'), {
        userId: 'alice',
        municipalityId: 'm1',
        status: 'pending',
        requestedAt: new Date(),
      });
      await setDoc(doc(db, 'municipalities/m2/joinRequests/alice'), {
        userId: 'alice',
        municipalityId: 'm2',
        status: 'pending',
        requestedAt: new Date(),
      });
    });
  }

  it('user can list their own joinRequests via collection group (where userId == uid)', async () => {
    await seedMultiMuniJoinRequests();
    const aliceDb = env.authenticatedContext('alice').firestore();
    await assertSucceeds(
      getDocs(query(
        collectionGroup(aliceDb, 'joinRequests'),
        where('userId', '==', 'alice'),
      )),
    );
  });

  it('user cannot list ALL joinRequests via collection group (no where clause)', async () => {
    await seedMultiMuniJoinRequests();
    const aliceDb = env.authenticatedContext('alice').firestore();
    await assertFails(
      getDocs(collectionGroup(aliceDb, 'joinRequests')),
    );
  });

  it('anonymous user cannot list joinRequests via collection group', async () => {
    await seedMultiMuniJoinRequests();
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(
      getDocs(query(
        collectionGroup(anon, 'joinRequests'),
        where('userId', '==', 'alice'),
      )),
    );
  });
});
