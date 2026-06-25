import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;

const M = 'm1';
function placeDoc(status: string, proposedBy: string | null) {
  return {
    name: 'Fuente', kind: 'plaza', description: null, municipalityId: M,
    imageURL: null, createdAt: new Date(), status, proposedBy,
    reviewedBy: null, reviewedAt: null,
  };
}
async function seedMember(uid: string, role: 'user' | 'admin' = 'user') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/members/${uid}`), {
      role, joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null, trustedNewsAuthor: false,
    });
  });
}
async function seedPlace(id: string, status: string, proposedBy: string | null) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/places/${id}`), placeDoc(status, proposedBy));
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

describe('firestore.rules — /municipalities/{m}/places (proposals)', () => {
  it('anyone can read places', async () => {
    await seedPlace('p1', 'approved', null);
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), `municipalities/${M}/places/p1`)));
  });

  it('member can create a pending place proposal carrying their uid', async () => {
    await seedMember('alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, `municipalities/${M}/places/p1`), placeDoc('pending', 'alice')));
  });

  it('member CANNOT create a place that is already approved', async () => {
    await seedMember('alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, `municipalities/${M}/places/p1`), placeDoc('approved', 'alice')));
  });

  it('member CANNOT create a proposal owned by someone else', async () => {
    await seedMember('alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, `municipalities/${M}/places/p1`), placeDoc('pending', 'bob')));
  });

  it('non-member cannot create any place', async () => {
    const stranger = env.authenticatedContext('stranger').firestore();
    await assertFails(setDoc(doc(stranger, `municipalities/${M}/places/p1`), placeDoc('pending', 'stranger')));
  });

  it('village admin can create an approved place directly', async () => {
    await seedMember('boss', 'admin');
    const boss = env.authenticatedContext('boss').firestore();
    await assertSucceeds(setDoc(doc(boss, `municipalities/${M}/places/p1`), placeDoc('approved', null)));
  });

  it('village admin can approve a pending proposal', async () => {
    await seedMember('boss', 'admin');
    await seedPlace('p1', 'pending', 'alice');
    const boss = env.authenticatedContext('boss').firestore();
    await assertSucceeds(updateDoc(doc(boss, `municipalities/${M}/places/p1`), { status: 'approved', reviewedBy: 'boss' }));
  });

  it('proposer can edit their own still-pending proposal', async () => {
    await seedMember('alice');
    await seedPlace('p1', 'pending', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(updateDoc(doc(alice, `municipalities/${M}/places/p1`), { name: 'Fuente Nueva' }));
  });

  it('proposer CANNOT approve their own proposal', async () => {
    await seedMember('alice');
    await seedPlace('p1', 'pending', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(alice, `municipalities/${M}/places/p1`), { status: 'approved', reviewedBy: 'alice' }));
  });

  it('proposer can withdraw (delete) their own pending proposal', async () => {
    await seedMember('alice');
    await seedPlace('p1', 'pending', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(deleteDoc(doc(alice, `municipalities/${M}/places/p1`)));
  });

  it('proposer CANNOT delete a proposal once approved', async () => {
    await seedMember('alice');
    await seedPlace('p1', 'approved', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(deleteDoc(doc(alice, `municipalities/${M}/places/p1`)));
  });
});
