// Firestore Rules e2e tests for event ownership via organizerUserIds.
//
// Asserts the new control model:
//   - create: village member + createdBy == uid + uid in organizerUserIds
//   - update: uid in organizerUserIds, or village admin, or app admin
//   - update: denied when changing createdBy or municipalityId
//   - org members (in organizerOrgIds but not organizerUserIds) CANNOT update
//
// These tests are the safety net for the Phase B rules change.

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;
const M = 'm1';
const ORG = 'org1';

// A full, schema-valid event payload using the new model.
function newEvent(createdBy: string, extraOrganizers: string[] = [], orgIds: string[] = []) {
  return {
    title: 'Fiesta',
    description: 'desc',
    startDate: new Date('2026-07-01'),
    location: { coordinates: { lat: 40.0, lng: -3.0 }, displayName: 'Plaza Mayor' },
    imageURL: null,
    maxAttendees: null,
    telephoneRequired: false,
    status: 'published',
    organizerUserIds: [createdBy, ...extraOrganizers],
    organizerOrgIds: orgIds,
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    municipalityId: M,
    villageName: 'Villa',
    villageCoverImage: null,
    villageCoordinates: null,
  };
}

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // Village members
    await setDoc(doc(db, `municipalities/${M}/members/alice`), { role: 'user', joinedAt: new Date() });
    await setDoc(doc(db, `municipalities/${M}/members/bob`), { role: 'user', joinedAt: new Date() });
    await setDoc(doc(db, `municipalities/${M}/members/charlie`), { role: 'user', joinedAt: new Date() });
    await setDoc(doc(db, `municipalities/${M}/members/villageboss`), { role: 'admin', joinedAt: new Date() });
    // Organization with carol as member (but NOT in organizerUserIds)
    await setDoc(doc(db, `organizations/${ORG}`), {
      name: 'Test Org',
      description: null,
      type: 'asociación',
      status: 'approved',
      municipalityId: M,
      requestedBy: 'alice',
      reviewedBy: null,
      createdAt: new Date(),
      reviewedAt: null,
    });
    await setDoc(doc(db, `organizations/${ORG}/members/carol`), { joinedAt: new Date(), role: 'member' });
    // Pre-existing event owned by alice, with bob as co-organizer and org1 as org
    await setDoc(doc(db, 'events/owned'), {
      ...newEvent('alice', ['bob'], [ORG]),
    });
  });
}

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: process.env.TEST_PROJECT_ID || 'cultuvilla-rules-test',
    firestore: { rules },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

afterAll(async () => {
  await env.cleanup();
});

describe('firestore.rules — event organizerUserIds control', () => {
  // ── create ────────────────────────────────────────────────────────────────

  it('a village member can create when createdBy == uid AND uid in organizerUserIds', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'events/new1'), newEvent('alice')));
  });

  it('denied: create with uid NOT in organizerUserIds', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'events/new2'), {
        ...newEvent('alice'),
        organizerUserIds: [], // alice missing
      }),
    );
  });

  it('denied: create by a non-village-member', async () => {
    const stranger = env.authenticatedContext('stranger').firestore();
    await assertFails(setDoc(doc(stranger, 'events/new3'), newEvent('stranger')));
  });

  it('denied: create when createdBy != uid', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'events/new4'), {
        ...newEvent('alice'),
        createdBy: 'bob', // mismatch
      }),
    );
  });

  // ── update ────────────────────────────────────────────────────────────────

  it('a user in organizerUserIds can update the event', async () => {
    const bob = env.authenticatedContext('bob').firestore();
    await assertSucceeds(updateDoc(doc(bob, 'events/owned'), { title: 'Feria' }));
  });

  it('the creator (in organizerUserIds) can update the event', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(updateDoc(doc(alice, 'events/owned'), { title: 'Feria' }));
  });

  it('a random village member NOT in organizerUserIds is denied update', async () => {
    const charlie = env.authenticatedContext('charlie').firestore();
    await assertFails(updateDoc(doc(charlie, 'events/owned'), { title: 'Feria' }));
  });

  it('a village admin can update the event', async () => {
    const vb = env.authenticatedContext('villageboss').firestore();
    await assertSucceeds(updateDoc(doc(vb, 'events/owned'), { title: 'Feria' }));
  });

  it('denied: update that changes createdBy', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(alice, 'events/owned'), { createdBy: 'bob' }));
  });

  it('denied: update that changes municipalityId', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(alice, 'events/owned'), { municipalityId: 'm2' }));
  });

  it('an org member in organizerOrgIds but NOT in organizerUserIds is denied update', async () => {
    // carol is in org1 (which is in organizerOrgIds) but NOT in organizerUserIds
    const carol = env.authenticatedContext('carol').firestore();
    await assertFails(updateDoc(doc(carol, 'events/owned'), { title: 'Feria' }));
  });

  // ── delete ────────────────────────────────────────────────────────────────

  it('a user in organizerUserIds can delete the event', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(deleteDoc(doc(alice, 'events/owned')));
  });

  it('a village admin can delete the event', async () => {
    const vb = env.authenticatedContext('villageboss').firestore();
    await assertSucceeds(deleteDoc(doc(vb, 'events/owned')));
  });

  it('a stranger cannot delete the event', async () => {
    const stranger = env.authenticatedContext('stranger').firestore();
    await assertFails(deleteDoc(doc(stranger, 'events/owned')));
  });

  it('a random village member NOT in organizerUserIds cannot delete', async () => {
    const charlie = env.authenticatedContext('charlie').firestore();
    await assertFails(deleteDoc(doc(charlie, 'events/owned')));
  });
});
