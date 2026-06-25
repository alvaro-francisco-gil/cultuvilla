// Trigger test for syncMemberBarrioToResidence. Drives the handler via
// firebase-functions-test's wrap()/makeChange() against the Firestore emulator.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../helpers/firestoreEmulator';
import { syncMemberBarrioToResidence } from '../../village/syncMemberBarrioToResidence';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });
const wrapped = ft.wrap(syncMemberBarrioToResidence);

const MUNI = 'mun-test';
const USER = 'user-test';
const PERSON = 'person-test';

interface MemberShape {
  userId: string;
  role: string;
  barrioId: string | null;
}

function member(overrides: Partial<MemberShape> = {}): MemberShape {
  return { userId: USER, role: 'user', barrioId: null, ...overrides };
}

async function seedPerson(municipalityLinks: unknown[]): Promise<void> {
  await admin.firestore().doc(`persons/${PERSON}`).set({
    givenName: 'Ana',
    userId: USER,
    municipalityLinks,
    createdBy: USER,
    createdAt: new Date(),
  });
}

async function seedBarrio(barrioId: string, status: 'approved' | 'pending'): Promise<void> {
  await admin.firestore().doc(`municipalities/${MUNI}/barrios/${barrioId}`).set({
    name: barrioId,
    status,
    municipalityId: MUNI,
    imageURL: null,
    createdAt: new Date(),
    proposedBy: null,
    reviewedBy: null,
    reviewedAt: null,
  });
}

async function personLinks(): Promise<unknown[]> {
  const snap = await admin.firestore().doc(`persons/${PERSON}`).get();
  return (snap.get('municipalityLinks') as unknown[] | undefined) ?? [];
}

/** Fire the trigger. Pass `null` for before/after to simulate create/delete. */
async function fire(before: MemberShape | null, after: MemberShape | null): Promise<void> {
  const path = `municipalities/${MUNI}/members/${USER}`;
  const beforeSnap = ft.firestore.makeDocumentSnapshot(
    (before ?? {}) as unknown as Record<string, unknown>,
    path,
  );
  const afterSnap = ft.firestore.makeDocumentSnapshot(
    (after ?? {}) as unknown as Record<string, unknown>,
    path,
  );
  await wrapped({
    data: ft.makeChange(beforeSnap, afterSnap),
    params: { municipalityId: MUNI, userId: USER },
  } as unknown as Parameters<typeof wrapped>[0]);
}

beforeAll(async () => {
  await resetEmulators();
});

beforeEach(async () => {
  await resetEmulators();
});

afterAll(() => {
  ft.cleanup();
});

describe('syncMemberBarrioToResidence', () => {
  it('appends a residence link when a member joins (create, no barrio)', async () => {
    await seedPerson([]);

    await fire(null, member({ barrioId: null }));

    expect(await personLinks()).toEqual([{ municipalityId: MUNI, barrioId: null }]);
  });

  it('upserts the chosen approved barrio into municipalityLinks', async () => {
    await seedBarrio('centro', 'approved');
    await seedPerson([{ municipalityId: MUNI, barrioId: null }]);

    await fire(member({ barrioId: null }), member({ barrioId: 'centro' }));

    expect(await personLinks()).toEqual([{ municipalityId: MUNI, barrioId: 'centro' }]);
  });

  it('normalizes a non-approved (pending) barrio to null', async () => {
    await seedBarrio('pending-one', 'pending');
    await seedPerson([{ municipalityId: MUNI, barrioId: null }]);

    await fire(member({ barrioId: null }), member({ barrioId: 'pending-one' }));

    expect(await personLinks()).toEqual([{ municipalityId: MUNI, barrioId: null }]);
  });

  it('normalizes an unknown/foreign barrio to null', async () => {
    await seedPerson([{ municipalityId: MUNI, barrioId: null }]);

    await fire(member({ barrioId: null }), member({ barrioId: 'does-not-exist' }));

    expect(await personLinks()).toEqual([{ municipalityId: MUNI, barrioId: null }]);
  });

  it('removes the residence link when the member leaves (delete)', async () => {
    await seedPerson([
      { municipalityId: MUNI, barrioId: 'centro' },
      { municipalityId: 'other', barrioId: null },
    ]);

    await fire(member({ barrioId: 'centro' }), null);

    expect(await personLinks()).toEqual([{ municipalityId: 'other', barrioId: null }]);
  });

  it('preserves links for other villages while upserting this one', async () => {
    await seedBarrio('centro', 'approved');
    await seedPerson([{ municipalityId: 'other', barrioId: 'x' }]);

    await fire(null, member({ barrioId: 'centro' }));

    const links = await personLinks();
    expect(links).toContainEqual({ municipalityId: 'other', barrioId: 'x' });
    expect(links).toContainEqual({ municipalityId: MUNI, barrioId: 'centro' });
    expect(links).toHaveLength(2);
  });

  it('is a no-op when the barrio did not change (idempotent)', async () => {
    await seedBarrio('centro', 'approved');
    await seedPerson([{ municipalityId: MUNI, barrioId: 'centro' }]);
    // Mutate an unrelated field server-side, then fire with unchanged barrioId.
    await admin.firestore().doc(`persons/${PERSON}`).update({ biography: 'sentinel' });

    await fire(member({ barrioId: 'centro' }), member({ barrioId: 'centro' }));

    const snap = await admin.firestore().doc(`persons/${PERSON}`).get();
    // The sentinel survives → the handler returned early without rewriting.
    expect(snap.get('biography')).toBe('sentinel');
    expect(snap.get('municipalityLinks')).toEqual([{ municipalityId: MUNI, barrioId: 'centro' }]);
  });

  it('skips when no person is linked to the user', async () => {
    // No person seeded → handler must not throw.
    await expect(fire(null, member({ barrioId: 'centro' }))).resolves.toBeUndefined();
  });
});
