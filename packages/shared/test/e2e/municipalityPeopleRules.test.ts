import { describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asAnon, asUser, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

async function seedDirectory() {
  await seed(getEnv(), async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'municipalities/m1/members/alice'), { userId: 'alice', role: 'user' });
    await setDoc(doc(db, 'municipalityPeople/m1_p1'), { municipalityId: 'm1', personId: 'p1', displayName: 'Ana', sortName: 'ana', photoURL: null, userId: null });
  });
}

describe('firestore.rules — municipalityPeople', () => {
  it('allows a village member to read their alphabetical directory query', async () => {
    await seedDirectory();
    const db = asUser(getEnv(), 'alice');
    await assertSucceeds(getDocs(query(collection(db, 'municipalityPeople'), where('municipalityId', '==', 'm1'))));
  });

  it('denies non-members and all client writes', async () => {
    await seedDirectory();
    await assertFails(getDocs(query(collection(asAnon(getEnv()), 'municipalityPeople'), where('municipalityId', '==', 'm1'))));
    await assertFails(setDoc(doc(asUser(getEnv(), 'alice'), 'municipalityPeople/m1_p2'), { municipalityId: 'm1' }));
  });
});
