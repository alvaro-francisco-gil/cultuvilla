// Firestore Rules e2e test for collection-group queries on 'members'.
// Verifies: a signed-in user can list their own membership rows across all
// municipalities via a collection-group query; they cannot list all memberships
// unfiltered; anonymous users cannot list at all; and direct per-doc reads
// continue to work for anyone (regression guard).
import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  collectionGroup,
  where,
} from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

const ALICE = 'alice';
const NOW = new Date();

async function seedActiveMunicipality(id = 'mActive') {
  await seed(getEnv(), async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `municipalities/${id}`), { name: 'Activo', communityActive: true });
  });
}

async function seedInactiveMunicipality(id = 'mInactive') {
  await seed(getEnv(), async (ctx) => {
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
  await seed(getEnv(), async (ctx) => {
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

describe('firestore.rules — members collection-group', () => {
  it('signed-in user can list their own memberships via collection group', async () => {
    await seedAliceMemberships();
    const db = asUser(getEnv(), ALICE);
    await assertSucceeds(
      getDocs(query(collectionGroup(db, 'members'), where('userId', '==', ALICE))),
    );
  });

  it('signed-in user cannot list ALL memberships unfiltered', async () => {
    await seedAliceMemberships();
    const db = asUser(getEnv(), ALICE);
    await assertFails(getDocs(collectionGroup(db, 'members')));
  });

  it('anonymous user cannot list memberships via collection group', async () => {
    await seedAliceMemberships();
    const db = asAnon(getEnv());
    await assertFails(
      getDocs(query(collectionGroup(db, 'members'), where('userId', '==', ALICE))),
    );
  });

  it('regression: direct doc read on /municipalities/{m}/members/{uid} still works for anyone', async () => {
    await seedAliceMemberships();
    const db = asAnon(getEnv());
    await assertSucceeds(getDoc(doc(db, 'municipalities/m1/members/alice')));
  });
});

describe('firestore.rules — self-join membership create', () => {
  it('owner can self-join an active village as role user', async () => {
    await seedActiveMunicipality();
    const db = asUser(getEnv(), ALICE);
    await assertSucceeds(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), memberDocData()),
    );
  });

  it('owner cannot self-join an inactive village', async () => {
    await seedInactiveMunicipality();
    const db = asUser(getEnv(), ALICE);
    await assertFails(
      setDoc(doc(db, 'municipalities/mInactive/members/alice'), memberDocData()),
    );
  });

  it('owner cannot self-join as role admin', async () => {
    await seedActiveMunicipality();
    const db = asUser(getEnv(), ALICE);
    await assertFails(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), {
        ...memberDocData(),
        role: 'admin',
      }),
    );
  });

  it('owner cannot self-grant trustedNewsAuthor on join', async () => {
    await seedActiveMunicipality();
    const db = asUser(getEnv(), ALICE);
    await assertFails(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), {
        ...memberDocData(),
        trustedNewsAuthor: true,
      }),
    );
  });

  it('user cannot create a membership doc for someone else', async () => {
    await seedActiveMunicipality();
    const db = asUser(getEnv(), 'mallory');
    await assertFails(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), memberDocData()),
    );
  });

  it('anonymous user cannot self-join', async () => {
    await seedActiveMunicipality();
    const db = asAnon(getEnv());
    await assertFails(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), memberDocData()),
    );
  });

  it('owner can self-join with a barrioId set', async () => {
    await seedActiveMunicipality();
    const db = asUser(getEnv(), ALICE);
    await assertSucceeds(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), {
        ...memberDocData(),
        barrioId: 'centro',
      }),
    );
  });
});

describe('firestore.rules — member barrioId self-update', () => {
  async function seedAliceMember() {
    await seed(getEnv(), async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'municipalities/mActive'), { name: 'Activo', communityActive: true });
      await setDoc(doc(db, 'municipalities/mActive/members/alice'), memberDocData());
    });
  }

  it('owner can update their own barrioId', async () => {
    await seedAliceMember();
    const db = asUser(getEnv(), ALICE);
    await assertSucceeds(
      updateDoc(doc(db, 'municipalities/mActive/members/alice'), { barrioId: 'centro' }),
    );
  });

  it('owner can clear their barrioId back to null', async () => {
    await seedAliceMember();
    const db = asUser(getEnv(), ALICE);
    await assertSucceeds(
      updateDoc(doc(db, 'municipalities/mActive/members/alice'), { barrioId: null }),
    );
  });

  it('owner cannot change role while updating barrioId', async () => {
    await seedAliceMember();
    const db = asUser(getEnv(), ALICE);
    await assertFails(
      updateDoc(doc(db, 'municipalities/mActive/members/alice'), {
        barrioId: 'centro',
        role: 'admin',
      }),
    );
  });

  it('a different user cannot update alice barrioId', async () => {
    await seedAliceMember();
    const db = asUser(getEnv(), 'mallory');
    await assertFails(
      updateDoc(doc(db, 'municipalities/mActive/members/alice'), { barrioId: 'centro' }),
    );
  });
});
