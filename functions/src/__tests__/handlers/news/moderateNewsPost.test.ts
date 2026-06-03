// Handler test for the moderateNewsPost callable.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../../helpers/firestoreEmulator';
import { moderateNewsPost } from '../../../news/moderateNewsPost';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });

const MUNICIPALITY_ID = 'mun-1';
const ADMIN_UID = 'vadmin';
const OUTSIDER_UID = 'eve';

async function seedMember(uid: string, role: 'admin' | 'user'): Promise<void> {
  await admin
    .firestore()
    .doc(`municipalities/${MUNICIPALITY_ID}/members/${uid}`)
    .set({
      userId: uid,
      role,
      joinedAt: new Date(),
      profileAnswers: {},
      profileCompletedAt: null,
      trustedNewsAuthor: false,
    });
}

async function seedPost(postId: string, status: 'pending' | 'approved' | 'rejected'): Promise<void> {
  const now = new Date();
  await admin
    .firestore()
    .doc(`news/${postId}`)
    .set({
      municipalityId: MUNICIPALITY_ID,
      authorUserId: 'author-1',
      authorOrgId: null,
      title: 'Fiesta del pueblo',
      body: 'Descripción',
      category: 'fiesta',
      images: [],
      status,
      rejectionReason: null,
      submittedAt: now,
      publishedAt: null,
      createdBy: 'author-1',
      updatedAt: now,
      reactionCounts: { like: 0, heart: 0 },
      commentCount: 0,
    });
}

interface CallableResult {
  ok: true;
}

async function callModerate(opts: { uid: string | null; data: unknown }): Promise<CallableResult> {
  const wrapped = ft.wrap(moderateNewsPost as unknown as Parameters<typeof ft.wrap>[0]);
  return (await wrapped({
    data: opts.data,
    auth: opts.uid ? { uid: opts.uid, token: {} } : undefined,
  } as unknown as Parameters<typeof wrapped>[0])) as unknown as CallableResult;
}

describe('moderateNewsPost (callable)', () => {
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
      callModerate({ uid: null, data: { postId: 'p1', decision: 'approved' } }),
    ).rejects.toThrow(/unauthenticated|inici/i);
  });

  it('throws permission-denied for non-admin caller', async () => {
    await seedPost('p1', 'pending');
    await expect(
      callModerate({ uid: OUTSIDER_UID, data: { postId: 'p1', decision: 'approved' } }),
    ).rejects.toThrow(/autorizado|permission-denied/i);
  });

  it('admin approves a pending post', async () => {
    await seedMember(ADMIN_UID, 'admin');
    await seedPost('p1', 'pending');

    const result = await callModerate({
      uid: ADMIN_UID,
      data: { postId: 'p1', decision: 'approved' },
    });
    expect(result.ok).toBe(true);

    const snap = await admin.firestore().doc('news/p1').get();
    expect(snap.data()?.status).toBe('approved');
    expect(snap.data()?.publishedAt).not.toBeNull();
    expect(snap.data()?.rejectionReason).toBeNull();
  });

  it('admin rejects a pending post with reason', async () => {
    await seedMember(ADMIN_UID, 'admin');
    await seedPost('p1', 'pending');

    await callModerate({
      uid: ADMIN_UID,
      data: { postId: 'p1', decision: 'rejected', reason: 'spam' },
    });

    const snap = await admin.firestore().doc('news/p1').get();
    expect(snap.data()?.status).toBe('rejected');
    expect(snap.data()?.rejectionReason).toBe('spam');
    expect(snap.data()?.publishedAt).toBeNull();
  });

  it('throws failed-precondition when post is already approved', async () => {
    await seedMember(ADMIN_UID, 'admin');
    await seedPost('p1', 'approved');

    await expect(
      callModerate({ uid: ADMIN_UID, data: { postId: 'p1', decision: 'approved' } }),
    ).rejects.toThrow(/moderado|failed-precondition/i);
  });
});
