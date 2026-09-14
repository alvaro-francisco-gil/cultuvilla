import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

const M = 'm1';

function wrappedDoc(status: 'draft' | 'published' | 'discarded') {
  return {
    municipalityId: M, villageName: 'Matabuena', year: 2026,
    blocks: [{ blockId: 'carmen', name: 'Carmen', start: new Date('2026-08-14T00:00:00Z'), end: new Date('2026-08-28T23:59:59Z') }],
    rangeStart: new Date('2026-08-14T00:00:00Z'), rangeEnd: new Date('2026-08-28T23:59:59Z'),
    status, autoPublishAt: null, computedAt: new Date(),
    stats: {
      eventCount: 14, confirmedCount: 240, waitlistedCount: 12, uniquePersonCount: 174,
      uniqueAccountCount: 92, commentCount: 6, censoCount: 272, censoParticipantCount: 137, posterCount: 1,
    },
    fullestEvent: null, mostCommentedEvent: null, topOrganizations: [], topOrganizers: [],
    images: {},
  };
}

async function seedMember(uid: string, role: 'user' | 'admin') {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/members/${uid}`), {
      role, joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null,
    });
  });
}

async function seedWrapped(id: string, status: 'draft' | 'published' | 'discarded') {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `villageWrapped/${id}`), wrappedDoc(status));
  });
}

describe('firestore.rules — /villageWrapped', () => {
  // A Wrapped is made to be forwarded: the recipient of a WhatsApp link may be
  // neither a member nor signed in, and the page still has to resolve.
  it('anyone, signed in or not, can read a published Wrapped', async () => {
    await seedWrapped('w1', 'published');
    await assertSucceeds(getDoc(doc(asAnon(getEnv()), 'villageWrapped/w1')));
  });

  it('a draft is invisible to an ordinary member', async () => {
    await seedWrapped('w1', 'draft');
    await seedMember('alice', 'user');
    await assertFails(getDoc(doc(asUser(getEnv(), 'alice'), 'villageWrapped/w1')));
  });

  it('a draft is invisible to an anonymous reader', async () => {
    await seedWrapped('w1', 'draft');
    await assertFails(getDoc(doc(asAnon(getEnv()), 'villageWrapped/w1')));
  });

  it('a village admin can read their own draft, to decide on it', async () => {
    await seedWrapped('w1', 'draft');
    await seedMember('bob', 'admin');
    await assertSucceeds(getDoc(doc(asUser(getEnv(), 'bob'), 'villageWrapped/w1')));
  });

  it('a discarded Wrapped stays hidden from members', async () => {
    await seedWrapped('w1', 'discarded');
    await seedMember('alice', 'user');
    await assertFails(getDoc(doc(asUser(getEnv(), 'alice'), 'villageWrapped/w1')));
  });

  // Publishing goes through respondToVillageWrapped, which checks authority and
  // logs it. A client write would let an admin publish by editing a field, and
  // let anyone else forge the numbers.
  it('nobody writes a Wrapped from a client — not even a village admin', async () => {
    await seedWrapped('w1', 'draft');
    await seedMember('bob', 'admin');
    const bob = asUser(getEnv(), 'bob');
    await assertFails(updateDoc(doc(bob, 'villageWrapped/w1'), { status: 'published' }));
    await assertFails(setDoc(doc(bob, 'villageWrapped/w2'), wrappedDoc('published')));
    await assertFails(deleteDoc(doc(bob, 'villageWrapped/w1')));
  });
});
