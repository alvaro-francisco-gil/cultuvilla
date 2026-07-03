import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser } from '../helpers/roles';
import {
  proposePlace, approvePlace,
  proposeBarrio, approveBarrio, rejectBarrio,
} from '../../src/services/municipalityService';
import * as firebaseModule from '../../src/firebase';

const getEnv = useRulesTestEnv();

// alice proposes (must be a member); admin approves/rejects (must be village admin).
beforeEach(async () => {
  await getEnv().withSecurityRulesDisabled(async (c) => {
    const db = c.firestore() as unknown as Firestore;
    const base = { joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null, trustedNewsAuthor: false };
    await setDoc(doc(db, 'municipalities/m1/members/alice'), { role: 'user', ...base });
    await setDoc(doc(db, 'municipalities/m1/members/admin'), { role: 'admin', ...base });
  });
});
afterAll(() => { vi.restoreAllMocks(); });

function ctxDb(uid: string): Firestore {
  return asUser(getEnv(), uid);
}
function useDbAs(uid: string) {
  vi.spyOn(firebaseModule, 'getDb').mockReturnValue(ctxDb(uid));
}
async function read(path: string) {
  let data: Record<string, unknown> | undefined;
  await getEnv().withSecurityRulesDisabled(async (c) => {
    data = (await getDoc(doc(c.firestore() as unknown as Firestore, path))).data();
  });
  return data;
}
async function seed(path: string, value: Record<string, unknown>) {
  await getEnv().withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore() as unknown as Firestore, path), value);
  });
}
const pendingPlace = { name: 'Ermita', kind: 'hermitage', description: null, municipalityId: 'm1', imageURL: null, createdAt: new Date(), status: 'pending', proposedBy: 'alice', reviewedBy: null, reviewedAt: null };
const pendingBarrio = { name: 'Norte', municipalityId: 'm1', imageURL: null, createdAt: new Date(), status: 'pending', proposedBy: 'alice', reviewedBy: null, reviewedAt: null };

describe('municipalityService — place/barrio proposals', () => {
  it('proposePlace writes a pending place carrying the proposer', async () => {
    useDbAs('alice');
    const id = await proposePlace('m1', { name: 'Fuente', kind: 'plaza', municipalityId: 'm1', proposedBy: 'alice' });
    const d = await read(`municipalities/m1/places/${id}`);
    expect(d?.status).toBe('pending');
    expect(d?.proposedBy).toBe('alice');
  });

  it('approvePlace flips status to approved and stamps reviewedBy', async () => {
    await seed('municipalities/m1/places/p1', pendingPlace);
    useDbAs('admin');
    await approvePlace('m1', 'p1', 'admin');
    const d = await read('municipalities/m1/places/p1');
    expect(d?.status).toBe('approved');
    expect(d?.reviewedBy).toBe('admin');
  });

  it('rejectBarrio flips status to rejected with null reviewedBy', async () => {
    await seed('municipalities/m1/barrios/b1', pendingBarrio);
    useDbAs('admin');
    await rejectBarrio('m1', 'b1');
    const d = await read('municipalities/m1/barrios/b1');
    expect(d?.status).toBe('rejected');
    expect(d?.reviewedBy).toBeNull();
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
