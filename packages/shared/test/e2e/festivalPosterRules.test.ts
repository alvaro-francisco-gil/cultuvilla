import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

const M = 'm1';
function posterDoc(proposedBy: string | null, extra: Record<string, unknown> = {}) {
  return {
    municipalityId: M, proposedBy, year: 2025, title: null, imageURL: null,
    datePrecision: 'year', startsAt: null, endsAt: null, createdAt: new Date(),
    status: 'active', hiddenBy: null, hiddenAt: null, hiddenReason: null,
    commentCount: 0, reactionCounts: { like: 0, heart: 0 },
    ...extra,
  };
}
async function seedMember(uid: string, role: 'user' | 'admin' = 'user') {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/members/${uid}`), {
      role, joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null,
    });
  });
}
async function seedPoster(id: string, proposedBy: string | null, extra: Record<string, unknown> = {}) {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `festivalPosters/${id}`), posterDoc(proposedBy, extra));
  });
}

describe('firestore.rules — /festivalPosters', () => {
  it('anyone can read festival posters', async () => {
    await seedPoster('p1', null);
    await assertSucceeds(getDoc(doc(asAnon(getEnv()), 'festivalPosters/p1')));
  });

  it('member can create an active poster carrying their uid (instant self-service)', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(setDoc(doc(alice, 'festivalPosters/p1'), posterDoc('alice')));
  });

  it('member CANNOT create a poster already hidden', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, 'festivalPosters/p1'), posterDoc('alice', { status: 'hidden' })),
    );
  });

  it('member CANNOT create a poster with non-null hiddenBy', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, 'festivalPosters/p1'), posterDoc('alice', { hiddenBy: 'alice' })),
    );
  });

  it('member CANNOT create a proposal owned by someone else', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(setDoc(doc(alice, 'festivalPosters/p1'), posterDoc('bob')));
  });

  it('non-member cannot create any poster', async () => {
    const stranger = asUser(getEnv(), 'stranger');
    await assertFails(setDoc(doc(stranger, 'festivalPosters/p1'), posterDoc('stranger')));
  });

  it('village admin can create a poster directly', async () => {
    await seedMember('boss', 'admin');
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(setDoc(doc(boss, 'festivalPosters/p1'), posterDoc(null)));
  });

  it('proposer can edit their own poster content fields', async () => {
    await seedMember('alice');
    await seedPoster('p1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(updateDoc(doc(alice, 'festivalPosters/p1'), { title: 'Fiestas 2025' }));
  });

  it('proposer CANNOT change status on their own poster', async () => {
    await seedMember('alice');
    await seedPoster('p1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(updateDoc(doc(alice, 'festivalPosters/p1'), { status: 'hidden' }));
  });

  it('proposer CANNOT set hiddenBy/hiddenAt/hiddenReason directly', async () => {
    await seedMember('alice');
    await seedPoster('p1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      updateDoc(doc(alice, 'festivalPosters/p1'), {
        hiddenBy: 'alice', hiddenAt: new Date(), hiddenReason: 'self-hide',
      }),
    );
  });

  it('village admin CANNOT change status via a plain client update either', async () => {
    await seedMember('boss', 'admin');
    await seedPoster('p1', 'alice');
    const boss = asUser(getEnv(), 'boss');
    await assertFails(updateDoc(doc(boss, 'festivalPosters/p1'), { status: 'hidden' }));
  });

  it('proposer can withdraw (delete) their own poster', async () => {
    await seedMember('alice');
    await seedPoster('p1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(deleteDoc(doc(alice, 'festivalPosters/p1')));
  });

  it('proposer CANNOT delete their own poster once hidden (moderation bypass)', async () => {
    await seedMember('alice');
    await seedPoster('p1', 'alice', { status: 'hidden', hiddenBy: 'boss', hiddenAt: new Date(), hiddenReason: 'spam' });
    const alice = asUser(getEnv(), 'alice');
    await assertFails(deleteDoc(doc(alice, 'festivalPosters/p1')));
  });

  it('village admin can delete a hidden poster', async () => {
    await seedMember('boss', 'admin');
    await seedPoster('p1', 'alice', { status: 'hidden', hiddenBy: 'boss', hiddenAt: new Date(), hiddenReason: 'spam' });
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(deleteDoc(doc(boss, 'festivalPosters/p1')));
  });
});
