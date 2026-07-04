// Handler test for the respondToJoinRequest callable.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../helpers/firestoreEmulator';
import { respondToJoinRequest } from '../../organizations/respondToJoinRequest';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });

const MUNICIPALITY_ID = 'mun-1';
const ORG_ID = 'org-1';
const ORG_NAME = 'Asociacion de Vecinos';
const REQUESTER_ID = 'alice';
const ORG_ADMIN_ID = 'bob';
const APP_ADMIN_ID = 'super-1';
const OUTSIDER_ID = 'eve';

async function seedOrg(): Promise<void> {
  await admin.firestore().doc(`organizations/${ORG_ID}`).set({
    name: ORG_NAME,
    municipalityId: MUNICIPALITY_ID,
    status: 'approved',
    type: 'asociación',
    description: 'Una asociacion de vecinos',
    imageURL: null,
    requestedBy: ORG_ADMIN_ID,
    reviewedBy: APP_ADMIN_ID,
    createdAt: new Date(),
    reviewedAt: new Date(),
  });
}

async function seedOrgMember(uid: string, role: 'admin' | 'member'): Promise<void> {
  await admin
    .firestore()
    .doc(`organizations/${ORG_ID}/members/${uid}`)
    .set({ joinedAt: new Date(), role });
}

async function seedAppAdmin(uid: string): Promise<void> {
  await admin.firestore().doc(`admins/${uid}`).set({ createdAt: new Date() });
}

async function seedJoinRequest(opts: {
  userId: string;
  orgId: string;
  municipalityId: string;
  status: 'pending' | 'approved' | 'rejected';
}): Promise<string> {
  const ref = admin.firestore().collection('organizationJoinRequests').doc();
  await ref.set({
    userId: opts.userId,
    orgId: opts.orgId,
    municipalityId: opts.municipalityId,
    status: opts.status,
    requestedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
  });
  return ref.id;
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
      callRespond({ uid: null, data: { requestId: 'whatever', decision: 'approved' } }),
    ).rejects.toThrow(/unauthenticated|sign in/i);
  });

  it('throws invalid-argument when requestId is missing', async () => {
    await expect(
      callRespond({ uid: ORG_ADMIN_ID, data: { decision: 'approved' } }),
    ).rejects.toThrow(/invalid-argument|required/i);
  });

  it('throws invalid-argument when decision is invalid', async () => {
    await expect(
      callRespond({ uid: ORG_ADMIN_ID, data: { requestId: 'x', decision: 'maybe' } }),
    ).rejects.toThrow(/invalid-argument|required/i);
  });

  it('throws not-found when the request does not exist', async () => {
    await seedOrg();
    await seedOrgMember(ORG_ADMIN_ID, 'admin');
    await expect(
      callRespond({ uid: ORG_ADMIN_ID, data: { requestId: 'missing-id', decision: 'approved' } }),
    ).rejects.toThrow(/not-found|not found/i);
  });

  it('throws permission-denied when caller is neither org admin nor app admin', async () => {
    await seedOrg();
    const requestId = await seedJoinRequest({
      userId: REQUESTER_ID,
      orgId: ORG_ID,
      municipalityId: MUNICIPALITY_ID,
      status: 'pending',
    });
    await expect(
      callRespond({ uid: OUTSIDER_ID, data: { requestId, decision: 'approved' } }),
    ).rejects.toThrow(/permission-denied|org admin/i);
  });

  it('throws failed-precondition when the request is already resolved', async () => {
    await seedOrg();
    await seedOrgMember(ORG_ADMIN_ID, 'admin');
    const requestId = await seedJoinRequest({
      userId: REQUESTER_ID,
      orgId: ORG_ID,
      municipalityId: MUNICIPALITY_ID,
      status: 'approved',
    });
    await expect(
      callRespond({ uid: ORG_ADMIN_ID, data: { requestId, decision: 'approved' } }),
    ).rejects.toThrow(/failed-precondition|already resolved/i);
  });

  it('approves: writes the member doc with role member and flips status to approved', async () => {
    await seedOrg();
    await seedOrgMember(ORG_ADMIN_ID, 'admin');
    const requestId = await seedJoinRequest({
      userId: REQUESTER_ID,
      orgId: ORG_ID,
      municipalityId: MUNICIPALITY_ID,
      status: 'pending',
    });

    const result = await callRespond({
      uid: ORG_ADMIN_ID,
      data: { requestId, decision: 'approved' },
    });
    expect(result.ok).toBe(true);

    // Request status flipped
    const reqDoc = await admin.firestore().doc(`organizationJoinRequests/${requestId}`).get();
    expect(reqDoc.data()?.status).toBe('approved');
    expect(reqDoc.data()?.reviewedBy).toBe(ORG_ADMIN_ID);
    expect(reqDoc.data()?.reviewedAt).not.toBeNull();

    // Member doc written with role 'member'
    const memberDoc = await admin
      .firestore()
      .doc(`organizations/${ORG_ID}/members/${REQUESTER_ID}`)
      .get();
    expect(memberDoc.exists).toBe(true);
    expect(memberDoc.data()?.role).toBe('member');

    // Audit: an 'added' membership event scoped to the org's municipality.
    const events = await admin.firestore().collection('membershipEvents').get();
    expect(events.size).toBe(1);
    expect(events.docs[0].data()).toMatchObject({
      scopeType: 'org',
      scopeId: ORG_ID,
      municipalityId: MUNICIPALITY_ID,
      targetUserId: REQUESTER_ID,
      action: 'added',
      toRole: 'member',
    });

    // Notification sent to requester
    const notifs = await admin
      .firestore()
      .collection(`users/${REQUESTER_ID}/notifications`)
      .get();
    expect(notifs.size).toBeGreaterThanOrEqual(1);
    expect(notifs.docs[0].data().type).toBe('join_request_approved');
  });

  it('approves: app admin (not org admin) can also approve', async () => {
    await seedOrg();
    await seedAppAdmin(APP_ADMIN_ID);
    const requestId = await seedJoinRequest({
      userId: REQUESTER_ID,
      orgId: ORG_ID,
      municipalityId: MUNICIPALITY_ID,
      status: 'pending',
    });

    const result = await callRespond({
      uid: APP_ADMIN_ID,
      data: { requestId, decision: 'approved' },
    });
    expect(result.ok).toBe(true);

    const memberDoc = await admin
      .firestore()
      .doc(`organizations/${ORG_ID}/members/${REQUESTER_ID}`)
      .get();
    expect(memberDoc.exists).toBe(true);
    expect(memberDoc.data()?.role).toBe('member');
  });

  it('rejects: flips status to rejected, no member doc written, notifies requester', async () => {
    await seedOrg();
    await seedOrgMember(ORG_ADMIN_ID, 'admin');
    const requestId = await seedJoinRequest({
      userId: REQUESTER_ID,
      orgId: ORG_ID,
      municipalityId: MUNICIPALITY_ID,
      status: 'pending',
    });

    await callRespond({ uid: ORG_ADMIN_ID, data: { requestId, decision: 'rejected' } });

    const reqDoc = await admin.firestore().doc(`organizationJoinRequests/${requestId}`).get();
    expect(reqDoc.data()?.status).toBe('rejected');

    // No member doc
    const memberDoc = await admin
      .firestore()
      .doc(`organizations/${ORG_ID}/members/${REQUESTER_ID}`)
      .get();
    expect(memberDoc.exists).toBe(false);

    // Notification sent
    const notifs = await admin
      .firestore()
      .collection(`users/${REQUESTER_ID}/notifications`)
      .get();
    expect(notifs.size).toBeGreaterThanOrEqual(1);
    expect(notifs.docs[0].data().type).toBe('join_request_rejected');
  });
});
