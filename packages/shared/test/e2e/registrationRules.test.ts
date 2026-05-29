// Firestore Rules e2e test for collection-group queries on 'registrations'.
// Verifies: a signed-in user can list their own registrations across all events
// via a collection-group query; they cannot list all registrations unfiltered;
// anonymous users cannot list at all; and direct per-doc reads continue to work
// for anyone (regression guard).
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

async function seedAliceRegistrations() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'events/e1'), { title: 'Feria 1' });
    await setDoc(doc(db, 'events/e1/registrations/r1'), {
      userId: ALICE,
      personId: 'p1',
      name: 'Alice',
      status: 'confirmed',
      position: 1,
      registeredAt: NOW,
    });
    await setDoc(doc(db, 'events/e2'), { title: 'Feria 2' });
    await setDoc(doc(db, 'events/e2/registrations/r2'), {
      userId: ALICE,
      personId: 'p1',
      name: 'Alice',
      status: 'confirmed',
      position: 1,
      registeredAt: NOW,
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

describe('firestore.rules — registrations collection-group', () => {
  it('signed-in user can list their own registrations across events', async () => {
    await seedAliceRegistrations();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      getDocs(
        query(
          collectionGroup(db, 'registrations'),
          where('userId', '==', ALICE),
        ),
      ),
    );
  });

  it('signed-in user cannot list ALL registrations unfiltered', async () => {
    await seedAliceRegistrations();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(getDocs(collectionGroup(db, 'registrations')));
  });

  it('anonymous user cannot list registrations via collection group', async () => {
    await seedAliceRegistrations();
    const db = env.unauthenticatedContext().firestore();
    await assertFails(
      getDocs(
        query(
          collectionGroup(db, 'registrations'),
          where('userId', '==', ALICE),
        ),
      ),
    );
  });

  it('regression: direct doc read on /events/{e}/registrations/{r} still works for anyone', async () => {
    await seedAliceRegistrations();
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'events/e1/registrations/r1')));
  });
});
