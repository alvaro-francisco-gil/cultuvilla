// Firestore Rules e2e test for collection-group queries on 'members'.
// Verifies: a signed-in user can list their own membership rows across all
// municipalities via a collection-group query; they cannot list all memberships
// unfiltered; anonymous users cannot list at all; and direct per-doc reads
// continue to work for anyone (regression guard).
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  collectionGroup,
  where,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;

const ALICE = 'alice';
const NOW = new Date();

async function seedActiveMunicipality(id = 'mActive') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `municipalities/${id}`), { name: 'Activo', communityActive: true });
  });
}

async function seedInactiveMunicipality(id = 'mInactive') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `municipalities/${id}`), { name: 'Inactivo', communityActive: false });
  });
}

function memberDocData() {
  return {
    userId: ALICE,
    role: 'user',
    joinedAt: NOW,
    profileAnswers: {},
    profileCompletedAt: null,
    trustedNewsAuthor: false,
  };
}

async function seedAliceMemberships() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'municipalities/m1'), { name: 'Salamanca' });
    await setDoc(doc(db, 'municipalities/m1/members/alice'), {
      userId: ALICE,
      role: 'member',
      joinedAt: NOW,
    });
    await setDoc(doc(db, 'municipalities/m2'), { name: 'Ávila' });
    await setDoc(doc(db, 'municipalities/m2/members/alice'), {
      userId: ALICE,
      role: 'member',
      joinedAt: NOW,
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

describe('firestore.rules — members collection-group', () => {
  it('signed-in user can list their own memberships via collection group', async () => {
    await seedAliceMemberships();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      getDocs(query(collectionGroup(db, 'members'), where('userId', '==', ALICE))),
    );
  });

  it('signed-in user cannot list ALL memberships unfiltered', async () => {
    await seedAliceMemberships();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(getDocs(collectionGroup(db, 'members')));
  });

  it('anonymous user cannot list memberships via collection group', async () => {
    await seedAliceMemberships();
    const db = env.unauthenticatedContext().firestore();
    await assertFails(
      getDocs(query(collectionGroup(db, 'members'), where('userId', '==', ALICE))),
    );
  });

  it('regression: direct doc read on /municipalities/{m}/members/{uid} still works for anyone', async () => {
    await seedAliceMemberships();
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'municipalities/m1/members/alice')));
  });
});

describe('firestore.rules — self-join membership create', () => {
  it('owner can self-join an active village as role user', async () => {
    await seedActiveMunicipality();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), memberDocData()),
    );
  });

  it('owner cannot self-join an inactive village', async () => {
    await seedInactiveMunicipality();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'municipalities/mInactive/members/alice'), memberDocData()),
    );
  });

  it('owner cannot self-join as role admin', async () => {
    await seedActiveMunicipality();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), {
        ...memberDocData(),
        role: 'admin',
      }),
    );
  });

  it('owner cannot self-grant trustedNewsAuthor on join', async () => {
    await seedActiveMunicipality();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), {
        ...memberDocData(),
        trustedNewsAuthor: true,
      }),
    );
  });

  it('user cannot create a membership doc for someone else', async () => {
    await seedActiveMunicipality();
    const db = env.authenticatedContext('mallory').firestore();
    await assertFails(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), memberDocData()),
    );
  });

  it('anonymous user cannot self-join', async () => {
    await seedActiveMunicipality();
    const db = env.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), memberDocData()),
    );
  });
});
