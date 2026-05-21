// Handler test for the requestJoinVillage callable.
// Runs against the Firestore + Auth emulators via firebase-admin and uses
// firebase-functions-test to wrap the v2 callable.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../helpers/firestoreEmulator';
import { requestJoinVillage } from '../../requestJoinVillage';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });

const MUNICIPALITY_ID = 'mun-1';
const USER_ID = 'alice';
const ADMIN_USER_ID = 'admin-1';

async function seedMunicipality(opts: {
  communityActive: boolean;
  adminUserId?: string | null;
}): Promise<void> {
  await admin.firestore().doc(`municipalities/${MUNICIPALITY_ID}`).set({
    name: 'Villarriba',
    communityActive: opts.communityActive,
    community: opts.adminUserId
      ? { adminUserId: opts.adminUserId, description: '', coverImages: [] }
      : null,
  });
}

async function seedMember(userId: string, role: 'admin' | 'user' = 'user'): Promise<void> {
  await admin
    .firestore()
    .doc(`municipalities/${MUNICIPALITY_ID}/members/${userId}`)
    .set({
      userId,
      role,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

async function seedJoinRequest(
  userId: string,
  status: 'pending' | 'approved' | 'rejected',
): Promise<void> {
  await admin
    .firestore()
    .doc(`municipalities/${MUNICIPALITY_ID}/joinRequests/${userId}`)
    .set({
      userId,
      status,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      message: null,
      reviewedAt: null,
      reviewedBy: null,
    });
}

interface CallableResult {
  ok: true;
}

async function callRequest(opts: { uid: string | null; data: unknown }): Promise<CallableResult> {
  const wrapped = ft.wrap(requestJoinVillage as unknown as Parameters<typeof ft.wrap>[0]);
  return (await wrapped({
    data: opts.data,
    auth: opts.uid ? { uid: opts.uid, token: {} } : undefined,
  } as unknown as Parameters<typeof wrapped>[0])) as unknown as CallableResult;
}

describe('requestJoinVillage (callable)', () => {
  beforeAll(async () => {
    await resetEmulators();
  });

  beforeEach(async () => {
    await resetEmulators();
  });

  afterAll(() => {
    ft.cleanup();
  });

  it('throws unauthenticated when no auth context', async () => {
    await seedMunicipality({ communityActive: true, adminUserId: ADMIN_USER_ID });
    await expect(
      callRequest({ uid: null, data: { municipalityId: MUNICIPALITY_ID } }),
    ).rejects.toThrow(/unauthenticated|inici/i);
  });

  it('throws invalid-argument when municipalityId is missing', async () => {
    await expect(callRequest({ uid: USER_ID, data: {} })).rejects.toThrow(/municipalityId/);
  });

  it('throws failed-precondition when community is not active', async () => {
    await seedMunicipality({ communityActive: false });
    await expect(
      callRequest({ uid: USER_ID, data: { municipalityId: MUNICIPALITY_ID } }),
    ).rejects.toThrow(/no está activa|failed-precondition/i);
  });

  it('throws already-exists when caller is already a member', async () => {
    await seedMunicipality({ communityActive: true, adminUserId: ADMIN_USER_ID });
    await seedMember(USER_ID, 'user');
    await expect(
      callRequest({ uid: USER_ID, data: { municipalityId: MUNICIPALITY_ID } }),
    ).rejects.toThrow(/miembro|already-exists/i);
  });

  it('throws already-exists when a pending request already exists', async () => {
    await seedMunicipality({ communityActive: true, adminUserId: ADMIN_USER_ID });
    await seedJoinRequest(USER_ID, 'pending');
    await expect(
      callRequest({ uid: USER_ID, data: { municipalityId: MUNICIPALITY_ID } }),
    ).rejects.toThrow(/pendiente|already-exists/i);
  });

  it('creates a pending joinRequest and notifies the village admin on happy path', async () => {
    await seedMunicipality({ communityActive: true, adminUserId: ADMIN_USER_ID });
    const result = await callRequest({
      uid: USER_ID,
      data: { municipalityId: MUNICIPALITY_ID, message: 'hola' },
    });
    expect(result.ok).toBe(true);

    const reqDoc = await admin
      .firestore()
      .doc(`municipalities/${MUNICIPALITY_ID}/joinRequests/${USER_ID}`)
      .get();
    expect(reqDoc.exists).toBe(true);
    expect(reqDoc.data()?.status).toBe('pending');
    expect(reqDoc.data()?.userId).toBe(USER_ID);
    expect(reqDoc.data()?.message).toBe('hola');

    const notifs = await admin
      .firestore()
      .collection(`users/${ADMIN_USER_ID}/notifications`)
      .get();
    expect(notifs.size).toBeGreaterThanOrEqual(1);
    expect(notifs.docs[0].data().type).toBe('join_request_created');
  });
});
