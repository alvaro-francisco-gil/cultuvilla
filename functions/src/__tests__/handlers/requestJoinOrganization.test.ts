// Handler test for the requestJoinOrganization callable.
// Runs against the Firestore + Auth emulators via firebase-admin and uses
// firebase-functions-test to wrap the v2 callable.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../helpers/firestoreEmulator';
import { requestJoinOrganization } from '../../organizations/requestJoinOrganization';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });

const MUNICIPALITY_ID = 'mun-1';
const ORG_ID = 'org-1';
const ORG_NAME = 'Asociacion de Vecinos';
const REQUESTER_ID = 'alice';
const ORG_ADMIN_ID = 'bob';
const APP_ADMIN_ID = 'super-1';

async function seedOrg(status: 'pending' | 'approved' | 'rejected'): Promise<void> {
  await admin.firestore().doc(`organizations/${ORG_ID}`).set({
    name: ORG_NAME,
    municipalityId: MUNICIPALITY_ID,
    status,
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
  await admin.firestore().doc(`organizations/${ORG_ID}/members/${uid}`).set({ joinedAt: new Date(), role });
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
  requestId: string;
}

async function callRequest(opts: { uid: string | null; data: unknown }): Promise<CallableResult> {
  const wrapped = ft.wrap(requestJoinOrganization as unknown as Parameters<typeof ft.wrap>[0]);
  return (await wrapped({
    data: opts.data,
    auth: opts.uid ? { uid: opts.uid, token: {} } : undefined,
  } as unknown as Parameters<typeof wrapped>[0])) as unknown as CallableResult;
}

describe('requestJoinOrganization (callable)', () => {
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
      callRequest({ uid: null, data: { orgId: ORG_ID } }),
    ).rejects.toThrow(/unauthenticated|sign in/i);
  });

  it('throws invalid-argument when orgId is missing', async () => {
    await expect(
      callRequest({ uid: REQUESTER_ID, data: {} }),
    ).rejects.toThrow(/invalid-argument|required/i);
  });

  it('throws not-found when the organization does not exist', async () => {
    await expect(
      callRequest({ uid: REQUESTER_ID, data: { orgId: 'missing-org' } }),
    ).rejects.toThrow(/not-found|not found/i);
  });

  it('throws failed-precondition when the organization is not approved', async () => {
    await seedOrg('pending');
    await expect(
      callRequest({ uid: REQUESTER_ID, data: { orgId: ORG_ID } }),
    ).rejects.toThrow(/failed-precondition|not approved/i);
  });

  it('throws already-exists when the caller is already a member', async () => {
    await seedOrg('approved');
    await seedOrgMember(REQUESTER_ID, 'member');
    await expect(
      callRequest({ uid: REQUESTER_ID, data: { orgId: ORG_ID } }),
    ).rejects.toThrow(/already-exists|already a member/i);
  });

  it('throws already-exists when a pending request already exists for the caller', async () => {
    await seedOrg('approved');
    await seedJoinRequest({
      userId: REQUESTER_ID,
      orgId: ORG_ID,
      municipalityId: MUNICIPALITY_ID,
      status: 'pending',
    });
    await expect(
      callRequest({ uid: REQUESTER_ID, data: { orgId: ORG_ID } }),
    ).rejects.toThrow(/already-exists|already exists/i);
  });

  it('creates a pending join request and does not notify org admins (the pending request itself is the actionable surface)', async () => {
    await seedOrg('approved');
    await seedOrgMember(ORG_ADMIN_ID, 'admin');

    const result = await callRequest({ uid: REQUESTER_ID, data: { orgId: ORG_ID } });
    expect(result.ok).toBe(true);
    expect(result.requestId).toBeTruthy();

    const orgAdminNotifs = await admin
      .firestore()
      .collection(`users/${ORG_ADMIN_ID}/notifications`)
      .get();
    expect(orgAdminNotifs.size).toBe(0);

    const created = await admin.firestore().doc(`organizationJoinRequests/${result.requestId}`).get();
    expect(created.exists).toBe(true);
    expect(created.data()?.status).toBe('pending');
    expect(created.data()?.userId).toBe(REQUESTER_ID);
    expect(created.data()?.orgId).toBe(ORG_ID);
    expect(created.data()?.municipalityId).toBe(MUNICIPALITY_ID);
    expect(created.data()?.reviewedAt).toBeNull();
    expect(created.data()?.reviewedBy).toBeNull();

    // Exactly one join request exists for this caller + org.
    const all = await admin
      .firestore()
      .collection('organizationJoinRequests')
      .where('userId', '==', REQUESTER_ID)
      .where('orgId', '==', ORG_ID)
      .get();
    expect(all.size).toBe(1);
    expect(all.docs[0].id).toBe(result.requestId);
  });
});
