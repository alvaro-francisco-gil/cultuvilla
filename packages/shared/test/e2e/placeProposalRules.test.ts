import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

const M = 'm1';
function placeDoc(proposedBy: string | null, extra: Record<string, unknown> = {}) {
  return {
    name: 'Fuente', kind: 'plaza', description: null, municipalityId: M,
    imageURL: null, createdAt: new Date(), status: 'active', proposedBy,
    hiddenBy: null, hiddenAt: null, hiddenReason: null,
    ...extra,
  };
}
async function seedMember(uid: string, role: 'user' | 'admin' = 'user') {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/members/${uid}`), {
      role, joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null, trustedNewsAuthor: false,
    });
  });
}
async function seedPlace(id: string, proposedBy: string | null, extra: Record<string, unknown> = {}) {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/places/${id}`), placeDoc(proposedBy, extra));
  });
}

describe('firestore.rules — /municipalities/{m}/places', () => {
  it('anyone can read places', async () => {
    await seedPlace('p1', null);
    await assertSucceeds(getDoc(doc(asAnon(getEnv()), `municipalities/${M}/places/p1`)));
  });

  it('member can create an active place carrying their uid (instant self-service)', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(setDoc(doc(alice, `municipalities/${M}/places/p1`), placeDoc('alice')));
  });

  it('member CANNOT create a place already hidden', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, `municipalities/${M}/places/p1`), placeDoc('alice', { status: 'hidden' })),
    );
  });

  it('member CANNOT create a place with non-null hiddenBy', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, `municipalities/${M}/places/p1`), placeDoc('alice', { hiddenBy: 'alice' })),
    );
  });

  it('member CANNOT create a proposal owned by someone else', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(setDoc(doc(alice, `municipalities/${M}/places/p1`), placeDoc('bob')));
  });

  it('non-member cannot create any place', async () => {
    const stranger = asUser(getEnv(), 'stranger');
    await assertFails(setDoc(doc(stranger, `municipalities/${M}/places/p1`), placeDoc('stranger')));
  });

  it('village admin can create a place directly', async () => {
    await seedMember('boss', 'admin');
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(setDoc(doc(boss, `municipalities/${M}/places/p1`), placeDoc(null)));
  });

  it('proposer can edit their own place content fields', async () => {
    await seedMember('alice');
    await seedPlace('p1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(updateDoc(doc(alice, `municipalities/${M}/places/p1`), { name: 'Fuente Nueva' }));
  });

  it('proposer CANNOT change status on their own place', async () => {
    await seedMember('alice');
    await seedPlace('p1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(updateDoc(doc(alice, `municipalities/${M}/places/p1`), { status: 'hidden' }));
  });

  it('proposer CANNOT set hiddenBy/hiddenAt/hiddenReason directly', async () => {
    await seedMember('alice');
    await seedPlace('p1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      updateDoc(doc(alice, `municipalities/${M}/places/p1`), {
        hiddenBy: 'alice', hiddenAt: new Date(), hiddenReason: 'self-hide',
      }),
    );
  });

  it('village admin CANNOT change status via a plain client update either', async () => {
    await seedMember('boss', 'admin');
    await seedPlace('p1', 'alice');
    const boss = asUser(getEnv(), 'boss');
    await assertFails(updateDoc(doc(boss, `municipalities/${M}/places/p1`), { status: 'hidden' }));
  });

  it('proposer can withdraw (delete) their own place', async () => {
    await seedMember('alice');
    await seedPlace('p1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(deleteDoc(doc(alice, `municipalities/${M}/places/p1`)));
  });

  it('proposer CANNOT delete their own place once hidden (moderation bypass)', async () => {
    await seedMember('alice');
    await seedPlace('p1', 'alice', { status: 'hidden', hiddenBy: 'boss', hiddenAt: new Date(), hiddenReason: 'spam' });
    const alice = asUser(getEnv(), 'alice');
    await assertFails(deleteDoc(doc(alice, `municipalities/${M}/places/p1`)));
  });

  it('village admin can delete a hidden place', async () => {
    await seedMember('boss', 'admin');
    await seedPlace('p1', 'alice', { status: 'hidden', hiddenBy: 'boss', hiddenAt: new Date(), hiddenReason: 'spam' });
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(deleteDoc(doc(boss, `municipalities/${M}/places/p1`)));
  });
});
