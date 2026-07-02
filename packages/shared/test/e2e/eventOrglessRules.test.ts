import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;
const M = 'm1';

// A full, schema-valid event payload (mirrors isValidEventCreate keys).
function orglessEvent(createdBy: string) {
  return {
    title: 'Fiesta', description: 'desc', startDate: new Date('2026-07-01'), endDate: null,
    location: { coordinates: { lat: 40.0, lng: -3.0 }, displayName: 'Plaza Mayor' },
    imageURL: null, maxAttendees: null, telephoneRequired: false,
    status: 'published', organizerUserIds: [createdBy], organizerOrgIds: [],
    createdBy, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    municipalityId: M, villageName: 'Villa',
    villageCoverImage: null, villageCoordinates: null,
  };
}

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `municipalities/${M}/members/member`), { role: 'member', joinedAt: new Date() });
    await setDoc(doc(db, `municipalities/${M}/members/villageboss`), { role: 'admin', joinedAt: new Date() });
    // Pre-existing event owned by `member`, for update/delete checks.
    await setDoc(doc(db, `events/owned`), { ...orglessEvent('member'), createdAt: new Date(), updatedAt: new Date(), startDate: new Date('2026-07-01') });
  });
}

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: process.env.TEST_PROJECT_ID || 'cultuvilla-rules-test',
    firestore: { rules },
  });
});
beforeEach(async () => { await env.clearFirestore(); await seed(); });
afterAll(async () => { await env.cleanup(); });

describe('firestore.rules — org-less events', () => {
  it('a village member can create an org-less event', async () => {
    const m = env.authenticatedContext('member').firestore();
    await assertSucceeds(setDoc(doc(m, `events/new1`), orglessEvent('member')));
  });

  it('a non-member cannot create an org-less event', async () => {
    const s = env.authenticatedContext('stranger').firestore();
    await assertFails(setDoc(doc(s, `events/new2`), orglessEvent('stranger')));
  });

  it('rejected: event with unknown legacy organizationId field (field not in schema)', async () => {
    const m = env.authenticatedContext('member').firestore();
    await assertFails(setDoc(doc(m, `events/orgnew`), { ...orglessEvent('member'), organizationId: 'org1' }));
  });

  it('the creator can update their own org-less event', async () => {
    const m = env.authenticatedContext('member').firestore();
    await assertSucceeds(updateDoc(doc(m, `events/owned`), { title: 'Nueva' }));
  });

  it('the creator can delete their own org-less event', async () => {
    const m = env.authenticatedContext('member').firestore();
    await assertSucceeds(deleteDoc(doc(m, `events/owned`)));
  });

  it('a stranger cannot delete an org-less event', async () => {
    const s = env.authenticatedContext('stranger').firestore();
    await assertFails(deleteDoc(doc(s, `events/owned`)));
  });

  it('a village admin can delete an org-less event', async () => {
    const vb = env.authenticatedContext('villageboss').firestore();
    await assertSucceeds(deleteDoc(doc(vb, `events/owned`)));
  });
});
