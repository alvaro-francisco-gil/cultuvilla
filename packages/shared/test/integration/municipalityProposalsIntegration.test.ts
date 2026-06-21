import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  proposePlace, approvePlace,
  proposeBarrio, approveBarrio, rejectBarrio,
} from '../../src/services/municipalityService';
import * as firebaseModule from '../../src/firebase';

let env: RulesTestEnvironment;

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: process.env.TEST_PROJECT_ID || 'cultuvilla-test',
    firestore: { rules },
  });
});
// alice proposes (must be a member); admin approves/rejects (must be village admin).
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore() as unknown as Firestore;
    const base = { joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null, trustedNewsAuthor: false };
    await setDoc(doc(db, 'municipalities/m1/members/alice'), { role: 'user', ...base });
    await setDoc(doc(db, 'municipalities/m1/members/admin'), { role: 'admin', ...base });
  });
});
afterAll(async () => { vi.restoreAllMocks(); await env.cleanup(); });

function ctxDb(uid: string): Firestore {
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}
function useDbAs(uid: string) {
  vi.spyOn(firebaseModule, 'getDb').mockReturnValue(ctxDb(uid));
}
async function read(path: string) {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (c) => {
    data = (await getDoc(doc(c.firestore() as unknown as Firestore, path))).data();
  });
  return data;
}
async function seed(path: string, value: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore() as unknown as Firestore, path), value);
  });
}
const pendingPlace = { name: 'Ermita', kind: 'hermitage', description: null, municipalityId: 'm1', imageURL: null, createdAt: new Date(), status: 'pending', proposedBy: 'alice', approvedBy: null, decidedAt: null };
const pendingBarrio = { name: 'Norte', municipalityId: 'm1', imageURL: null, createdAt: new Date(), status: 'pending', proposedBy: 'alice', approvedBy: null, decidedAt: null };

describe('municipalityService — place/barrio proposals', () => {
  it('proposePlace writes a pending place carrying the proposer', async () => {
    useDbAs('alice');
    const id = await proposePlace('m1', { name: 'Fuente', kind: 'plaza', municipalityId: 'm1', proposedBy: 'alice' });
    const d = await read(`municipalities/m1/places/${id}`);
    expect(d?.status).toBe('pending');
    expect(d?.proposedBy).toBe('alice');
  });

  it('approvePlace flips status to approved and stamps approvedBy', async () => {
    await seed('municipalities/m1/places/p1', pendingPlace);
    useDbAs('admin');
    await approvePlace('m1', 'p1', 'admin');
    const d = await read('municipalities/m1/places/p1');
    expect(d?.status).toBe('approved');
    expect(d?.approvedBy).toBe('admin');
  });

  it('rejectBarrio flips status to rejected with null approvedBy', async () => {
    await seed('municipalities/m1/barrios/b1', pendingBarrio);
    useDbAs('admin');
    await rejectBarrio('m1', 'b1');
    const d = await read('municipalities/m1/barrios/b1');
    expect(d?.status).toBe('rejected');
    expect(d?.approvedBy).toBeNull();
  });

  it('proposeBarrio + approveBarrio round-trip', async () => {
    useDbAs('alice');
    const id = await proposeBarrio('m1', { name: 'Sur', municipalityId: 'm1', proposedBy: 'alice' });
    useDbAs('admin');
    await approveBarrio('m1', id, 'admin');
    const d = await read(`municipalities/m1/barrios/${id}`);
    expect(d?.status).toBe('approved');
  });
});
