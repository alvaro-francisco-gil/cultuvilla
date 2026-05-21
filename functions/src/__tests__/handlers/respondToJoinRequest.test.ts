// Handler test for the respondToJoinRequest callable.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../helpers/firestoreEmulator';
import { respondToJoinRequest } from '../../respondToJoinRequest';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });

const MUNICIPALITY_ID = 'mun-1';
const REQUESTER_ID = 'alice';
const VILLAGE_ADMIN_ID = 'vadmin';
const OUTSIDER_ID = 'eve';

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

async function seedMember(userId: string, role: 'admin' | 'user'): Promise<void> {
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

async function callRespond(opts: { uid: string | null; data: unknown }): Promise<CallableResult> {
  const wrapped = ft.wrap(respondToJoinRequest as unknown as Parameters<typeof ft.wrap>[0]);
  return (await wrapped({
    data: opts.data,
    auth: opts.uid ? { uid: opts.uid, token: {} } : undefined,
  } as unknown as Parameters<typeof wrapped>[0])) as unknown as CallableResult;
}

describe('respondToJoinRequest (callable)', () => {
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
    await expect(
      callRespond({
        uid: null,
        data: {
          municipalityId: MUNICIPALITY_ID,
          userId: REQUESTER_ID,
          decision: 'approved',
        },
      }),
    ).rejects.toThrow(/unauthenticated|inici/i);
  });

  it('throws permission-denied when caller is not any kind of admin', async () => {
    await seedMunicipality({ communityActive: true, adminUserId: 'someone-else' });
    await seedJoinRequest(REQUESTER_ID, 'pending');
    await expect(
      callRespond({
        uid: OUTSIDER_ID,
        data: {
          municipalityId: MUNICIPALITY_ID,
          userId: REQUESTER_ID,
          decision: 'approved',
        },
      }),
    ).rejects.toThrow(/autorizado|permission-denied/i);
  });

  it('throws not-found when the join request does not exist', async () => {
    await seedMunicipality({ communityActive: true, adminUserId: VILLAGE_ADMIN_ID });
    await seedMember(VILLAGE_ADMIN_ID, 'admin');
    await expect(
      callRespond({
        uid: VILLAGE_ADMIN_ID,
        data: {
          municipalityId: MUNICIPALITY_ID,
          userId: REQUESTER_ID,
          decision: 'approved',
        },
      }),
    ).rejects.toThrow(/no encontrada|not.?found/i);
  });

  it('throws failed-precondition when the request is already resolved', async () => {
    await seedMunicipality({ communityActive: true, adminUserId: VILLAGE_ADMIN_ID });
    await seedMember(VILLAGE_ADMIN_ID, 'admin');
    await seedJoinRequest(REQUESTER_ID, 'approved');
    await expect(
      callRespond({
        uid: VILLAGE_ADMIN_ID,
        data: {
          municipalityId: MUNICIPALITY_ID,
          userId: REQUESTER_ID,
          decision: 'approved',
        },
      }),
    ).rejects.toThrow(/ya fue resuelta|failed-precondition/i);
  });

  it('approves: sets status, creates member doc, notifies requester', async () => {
    await seedMunicipality({ communityActive: true, adminUserId: VILLAGE_ADMIN_ID });
    await seedMember(VILLAGE_ADMIN_ID, 'admin');
    await seedJoinRequest(REQUESTER_ID, 'pending');

    const result = await callRespond({
      uid: VILLAGE_ADMIN_ID,
      data: {
        municipalityId: MUNICIPALITY_ID,
        userId: REQUESTER_ID,
        decision: 'approved',
      },
    });
    expect(result.ok).toBe(true);

    const reqDoc = await admin
      .firestore()
      .doc(`municipalities/${MUNICIPALITY_ID}/joinRequests/${REQUESTER_ID}`)
      .get();
    expect(reqDoc.data()?.status).toBe('approved');
    expect(reqDoc.data()?.reviewedBy).toBe(VILLAGE_ADMIN_ID);

    const memberDoc = await admin
      .firestore()
      .doc(`municipalities/${MUNICIPALITY_ID}/members/${REQUESTER_ID}`)
      .get();
    expect(memberDoc.exists).toBe(true);
    expect(memberDoc.data()?.role).toBe('user');

    const notifs = await admin
      .firestore()
      .collection(`users/${REQUESTER_ID}/notifications`)
      .get();
    expect(notifs.size).toBeGreaterThanOrEqual(1);
    expect(notifs.docs[0].data().type).toBe('join_request_approved');
  });

  it('rejects: sets status, creates no member doc, notifies requester', async () => {
    await seedMunicipality({ communityActive: true, adminUserId: VILLAGE_ADMIN_ID });
    await seedMember(VILLAGE_ADMIN_ID, 'admin');
    await seedJoinRequest(REQUESTER_ID, 'pending');

    await callRespond({
      uid: VILLAGE_ADMIN_ID,
      data: {
        municipalityId: MUNICIPALITY_ID,
        userId: REQUESTER_ID,
        decision: 'rejected',
      },
    });

    const reqDoc = await admin
      .firestore()
      .doc(`municipalities/${MUNICIPALITY_ID}/joinRequests/${REQUESTER_ID}`)
      .get();
    expect(reqDoc.data()?.status).toBe('rejected');

    const memberDoc = await admin
      .firestore()
      .doc(`municipalities/${MUNICIPALITY_ID}/members/${REQUESTER_ID}`)
      .get();
    expect(memberDoc.exists).toBe(false);

    const notifs = await admin
      .firestore()
      .collection(`users/${REQUESTER_ID}/notifications`)
      .get();
    expect(notifs.size).toBeGreaterThanOrEqual(1);
    expect(notifs.docs[0].data().type).toBe('join_request_rejected');
  });
});
