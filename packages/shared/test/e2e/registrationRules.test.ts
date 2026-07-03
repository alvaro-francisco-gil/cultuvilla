// Firestore Rules e2e test for collection-group queries on 'registrations'.
// Verifies: a signed-in user can list their own registrations across all events
// via a collection-group query; they cannot list all registrations unfiltered;
// anonymous users cannot list at all; and direct per-doc reads continue to work
// for anyone (regression guard).
import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  collectionGroup,
  where,
} from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

const ALICE = 'alice';
const NOW = new Date();

async function seedAliceRegistrations() {
  await seed(getEnv(), async (ctx) => {
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

describe('firestore.rules — registrations collection-group', () => {
  it('signed-in user can list their own registrations across events', async () => {
    await seedAliceRegistrations();
    const db = asUser(getEnv(), ALICE);
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
    const db = asUser(getEnv(), ALICE);
    await assertFails(getDocs(collectionGroup(db, 'registrations')));
  });

  it('anonymous user cannot list registrations via collection group', async () => {
    await seedAliceRegistrations();
    const db = asAnon(getEnv());
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
    const db = asAnon(getEnv());
    await assertSucceeds(getDoc(doc(db, 'events/e1/registrations/r1')));
  });
});
