// Firestore Rules e2e tests for event ownership via organizerUserIds.
//
// Asserts the new control model:
//   - create: village member + createdBy == uid + uid in organizerUserIds
//   - update: uid in organizerUserIds, or village admin, or app admin
//   - update: denied when changing createdBy or municipalityId
//   - org members (in organizerOrgIds but not organizerUserIds) CANNOT update
//
// These tests are the safety net for the Phase B rules change.

import { describe, it, beforeEach } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, GeoPoint } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser } from '../helpers/roles';

const getEnv = useRulesTestEnv();
const M = 'm1';
const ORG = 'org1';

// A full, schema-valid event payload using the new model.
function newEvent(createdBy: string, extraOrganizers: string[] = [], orgIds: string[] = []) {
  return {
    title: 'Fiesta',
    description: 'desc',
    startDate: new Date('2026-07-01'),
    endDate: null,
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
    // Single-day: endBoundary must equal startDate (rules consistency check).
    endBoundary: new Date('2026-07-01'),
  };
}

async function seed() {
  await getEnv().withSecurityRulesDisabled(async (ctx) => {
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

beforeEach(async () => {
  await seed();
});

describe('firestore.rules — event organizerUserIds control', () => {
  // ── create ────────────────────────────────────────────────────────────────

  it('a village member can create when createdBy == uid AND uid in organizerUserIds', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(setDoc(doc(alice, 'events/new1'), newEvent('alice')));
  });

  it('denied: create with uid NOT in organizerUserIds', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, 'events/new2'), {
        ...newEvent('alice'),
        organizerUserIds: [], // alice missing
      }),
    );
  });

  it('a village member can create with a GeoPoint villageCoordinates (converter output)', async () => {
    // The client converter denormalizes {lat,lng} -> GeoPoint on write, so the
    // persisted villageCoordinates is a GeoPoint (rules type `latlng`), NOT a
    // map. The create rule must accept it. Regression: events with real village
    // coordinates were denied because the rule checked `is map`.
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(
      setDoc(doc(alice, 'events/geo1'), {
        ...newEvent('alice'),
        villageCoordinates: new GeoPoint(40.0, -3.0),
      }),
    );
  });

  it('create with the EXACT converter output: GeoPoint location.coordinates + GeoPoint villageCoordinates + co-organizer', async () => {
    // Mirrors the real client write (converter turns every {lat,lng} into a
    // GeoPoint). Reproduces the reported production create failure.
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(
      setDoc(doc(alice, 'events/prod1'), {
        ...newEvent('alice', ['bob']),
        location: { coordinates: new GeoPoint(41.096, -3.758), displayName: 'Plaza Mayor' },
        villageCoordinates: new GeoPoint(41.096, -3.758),
      }),
    );
  });

  it('denied: create by a non-village-member', async () => {
    const stranger = asUser(getEnv(), 'stranger');
    await assertFails(setDoc(doc(stranger, 'events/new3'), newEvent('stranger')));
  });

  it('denied: create when createdBy != uid', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, 'events/new4'), {
        ...newEvent('alice'),
        createdBy: 'bob', // mismatch
      }),
    );
  });

  // ── update ────────────────────────────────────────────────────────────────

  it('a user in organizerUserIds can update the event', async () => {
    const bob = asUser(getEnv(), 'bob');
    await assertSucceeds(updateDoc(doc(bob, 'events/owned'), { title: 'Feria' }));
  });

  it('the creator (in organizerUserIds) can update the event', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(updateDoc(doc(alice, 'events/owned'), { title: 'Feria' }));
  });

  it('a random village member NOT in organizerUserIds is denied update', async () => {
    const charlie = asUser(getEnv(), 'charlie');
    await assertFails(updateDoc(doc(charlie, 'events/owned'), { title: 'Feria' }));
  });

  it('a village admin can update the event', async () => {
    const vb = asUser(getEnv(), 'villageboss');
    await assertSucceeds(updateDoc(doc(vb, 'events/owned'), { title: 'Feria' }));
  });

  it('denied: update that changes createdBy', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertFails(updateDoc(doc(alice, 'events/owned'), { createdBy: 'bob' }));
  });

  it('denied: update that changes municipalityId', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertFails(updateDoc(doc(alice, 'events/owned'), { municipalityId: 'm2' }));
  });

  it('an org member in organizerOrgIds but NOT in organizerUserIds is denied update', async () => {
    // carol is in org1 (which is in organizerOrgIds) but NOT in organizerUserIds
    const carol = asUser(getEnv(), 'carol');
    await assertFails(updateDoc(doc(carol, 'events/owned'), { title: 'Feria' }));
  });

  // ── delete ────────────────────────────────────────────────────────────────

  it('a user in organizerUserIds can delete the event', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(deleteDoc(doc(alice, 'events/owned')));
  });

  it('a village admin can delete the event', async () => {
    const vb = asUser(getEnv(), 'villageboss');
    await assertSucceeds(deleteDoc(doc(vb, 'events/owned')));
  });

  it('a stranger cannot delete the event', async () => {
    const stranger = asUser(getEnv(), 'stranger');
    await assertFails(deleteDoc(doc(stranger, 'events/owned')));
  });

  it('a random village member NOT in organizerUserIds cannot delete', async () => {
    const charlie = asUser(getEnv(), 'charlie');
    await assertFails(deleteDoc(doc(charlie, 'events/owned')));
  });
});
