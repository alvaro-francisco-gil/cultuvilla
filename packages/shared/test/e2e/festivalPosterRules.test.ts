import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

const M = 'm1';
function posterDoc(status: string, proposedBy: string | null) {
  return {
    municipalityId: M, proposedBy, year: 2025, title: null, imageURL: null,
    datePrecision: 'year', startsAt: null, endsAt: null, createdAt: new Date(),
    status, reviewedBy: null, reviewedAt: null,
  };
}
async function seedMember(uid: string, role: 'user' | 'admin' = 'user') {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/members/${uid}`), {
      role, joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null, trustedNewsAuthor: false,
    });
  });
}
async function seedPoster(id: string, status: string, proposedBy: string | null) {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `festivalPosters/${id}`), posterDoc(status, proposedBy));
  });
}

describe('firestore.rules — /festivalPosters (proposals)', () => {
  it('anyone can read festival posters', async () => {
    await seedPoster('p1', 'approved', null);
    await assertSucceeds(getDoc(doc(asAnon(getEnv()), 'festivalPosters/p1')));
  });

  it('member can create a pending poster proposal carrying their uid', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(setDoc(doc(alice, 'festivalPosters/p1'), posterDoc('pending', 'alice')));
  });

  it('member CANNOT create a poster that is already approved', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(setDoc(doc(alice, 'festivalPosters/p1'), posterDoc('approved', 'alice')));
  });

  it('member CANNOT create a proposal owned by someone else', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(setDoc(doc(alice, 'festivalPosters/p1'), posterDoc('pending', 'bob')));
  });

  it('non-member cannot create any poster', async () => {
    const stranger = asUser(getEnv(), 'stranger');
    await assertFails(setDoc(doc(stranger, 'festivalPosters/p1'), posterDoc('pending', 'stranger')));
  });

  it('village admin can create an approved poster directly', async () => {
    await seedMember('boss', 'admin');
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(setDoc(doc(boss, 'festivalPosters/p1'), posterDoc('approved', null)));
  });

  it('village admin can approve a pending proposal', async () => {
    await seedMember('boss', 'admin');
    await seedPoster('p1', 'pending', 'alice');
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(updateDoc(doc(boss, 'festivalPosters/p1'), { status: 'approved', reviewedBy: 'boss' }));
  });

  it('proposer can edit their own still-pending proposal', async () => {
    await seedMember('alice');
    await seedPoster('p1', 'pending', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(updateDoc(doc(alice, 'festivalPosters/p1'), { title: 'Fiestas 2025' }));
  });

  it('proposer CANNOT approve their own proposal', async () => {
    await seedMember('alice');
    await seedPoster('p1', 'pending', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(updateDoc(doc(alice, 'festivalPosters/p1'), { status: 'approved', reviewedBy: 'alice' }));
  });

  it('proposer can withdraw (delete) their own pending proposal', async () => {
    await seedMember('alice');
    await seedPoster('p1', 'pending', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(deleteDoc(doc(alice, 'festivalPosters/p1')));
  });

  it('proposer CANNOT delete a proposal once approved', async () => {
    await seedMember('alice');
    await seedPoster('p1', 'approved', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(deleteDoc(doc(alice, 'festivalPosters/p1')));
  });
});
