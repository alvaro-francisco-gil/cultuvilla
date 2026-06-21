import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;
const M = 'm1';
function barrioDoc(status: string, proposedBy: string | null) {
  return {
    name: 'Norte', municipalityId: M, imageURL: null, createdAt: new Date(),
    status, proposedBy, approvedBy: null, decidedAt: null,
  };
}
async function seedMember(uid: string, role: 'user' | 'admin' = 'user') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/members/${uid}`), {
      role, joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null, trustedNewsAuthor: false,
    });
  });
}
async function seedBarrio(id: string, status: string, proposedBy: string | null) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/barrios/${id}`), barrioDoc(status, proposedBy));
  });
}

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: process.env.TEST_PROJECT_ID || 'cultuvilla-rules-test',
    firestore: { rules },
  });
});
beforeEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });

describe('firestore.rules — /municipalities/{m}/barrios (proposals)', () => {
  it('anyone can read barrios', async () => {
    await seedBarrio('b1', 'approved', null);
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), `municipalities/${M}/barrios/b1`)));
  });
  it('member can create a pending barrio proposal', async () => {
    await seedMember('alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, `municipalities/${M}/barrios/b1`), barrioDoc('pending', 'alice')));
  });
  it('member CANNOT create an approved barrio', async () => {
    await seedMember('alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, `municipalities/${M}/barrios/b1`), barrioDoc('approved', 'alice')));
  });
  it('non-member cannot create a barrio', async () => {
    const stranger = env.authenticatedContext('stranger').firestore();
    await assertFails(setDoc(doc(stranger, `municipalities/${M}/barrios/b1`), barrioDoc('pending', 'stranger')));
  });
  it('village admin can create an approved barrio directly', async () => {
    await seedMember('boss', 'admin');
    const boss = env.authenticatedContext('boss').firestore();
    await assertSucceeds(setDoc(doc(boss, `municipalities/${M}/barrios/b1`), barrioDoc('approved', null)));
  });
  it('village admin can approve a pending barrio', async () => {
    await seedMember('boss', 'admin');
    await seedBarrio('b1', 'pending', 'alice');
    const boss = env.authenticatedContext('boss').firestore();
    await assertSucceeds(updateDoc(doc(boss, `municipalities/${M}/barrios/b1`), { status: 'approved', approvedBy: 'boss' }));
  });
  it('proposer can edit own pending barrio but not approve it', async () => {
    await seedMember('alice');
    await seedBarrio('b1', 'pending', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(updateDoc(doc(alice, `municipalities/${M}/barrios/b1`), { name: 'Norte Alto' }));
    await assertFails(updateDoc(doc(alice, `municipalities/${M}/barrios/b1`), { status: 'approved', approvedBy: 'alice' }));
  });
  it('proposer can withdraw own pending barrio but not an approved one', async () => {
    await seedMember('alice');
    await seedBarrio('b1', 'pending', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(deleteDoc(doc(alice, `municipalities/${M}/barrios/b1`)));
    await seedBarrio('b2', 'approved', 'alice');
    await assertFails(deleteDoc(doc(alice, `municipalities/${M}/barrios/b2`)));
  });
});
