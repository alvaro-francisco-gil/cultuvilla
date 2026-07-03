import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();
const M = 'm1';
function barrioDoc(status: string, proposedBy: string | null) {
  return {
    name: 'Norte', municipalityId: M, imageURL: null, createdAt: new Date(),
    status, proposedBy, reviewedBy: null, reviewedAt: null,
  };
}
async function seedMember(uid: string, role: 'user' | 'admin' = 'user') {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/members/${uid}`), {
      role, joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null, trustedNewsAuthor: false,
    });
  });
}
async function seedBarrio(id: string, status: string, proposedBy: string | null) {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/barrios/${id}`), barrioDoc(status, proposedBy));
  });
}

describe('firestore.rules — /municipalities/{m}/barrios (proposals)', () => {
  it('anyone can read barrios', async () => {
    await seedBarrio('b1', 'approved', null);
    await assertSucceeds(getDoc(doc(asAnon(getEnv()), `municipalities/${M}/barrios/b1`)));
  });
  it('member can create a pending barrio proposal', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(setDoc(doc(alice, `municipalities/${M}/barrios/b1`), barrioDoc('pending', 'alice')));
  });
  it('member CANNOT create an approved barrio', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(setDoc(doc(alice, `municipalities/${M}/barrios/b1`), barrioDoc('approved', 'alice')));
  });
  it('non-member cannot create a barrio', async () => {
    const stranger = asUser(getEnv(), 'stranger');
    await assertFails(setDoc(doc(stranger, `municipalities/${M}/barrios/b1`), barrioDoc('pending', 'stranger')));
  });
  it('village admin can create an approved barrio directly', async () => {
    await seedMember('boss', 'admin');
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(setDoc(doc(boss, `municipalities/${M}/barrios/b1`), barrioDoc('approved', null)));
  });
  it('village admin can approve a pending barrio', async () => {
    await seedMember('boss', 'admin');
    await seedBarrio('b1', 'pending', 'alice');
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(updateDoc(doc(boss, `municipalities/${M}/barrios/b1`), { status: 'approved', reviewedBy: 'boss' }));
  });
  it('proposer can edit own pending barrio but not approve it', async () => {
    await seedMember('alice');
    await seedBarrio('b1', 'pending', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(updateDoc(doc(alice, `municipalities/${M}/barrios/b1`), { name: 'Norte Alto' }));
    await assertFails(updateDoc(doc(alice, `municipalities/${M}/barrios/b1`), { status: 'approved', reviewedBy: 'alice' }));
  });
  it('proposer can withdraw own pending barrio but not an approved one', async () => {
    await seedMember('alice');
    await seedBarrio('b1', 'pending', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(deleteDoc(doc(alice, `municipalities/${M}/barrios/b1`)));
    await seedBarrio('b2', 'approved', 'alice');
    await assertFails(deleteDoc(doc(alice, `municipalities/${M}/barrios/b2`)));
  });
});
