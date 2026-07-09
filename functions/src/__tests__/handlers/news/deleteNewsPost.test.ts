// Handler test for the deleteNewsPost callable.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../../helpers/firestoreEmulator';
import { deleteNewsPost } from '../../../news/deleteNewsPost';

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

async function seedPost(postId: string): Promise<void> {
  const now = new Date();
  await admin.firestore().doc(`news/${postId}`).set({
    municipalityId: MUNICIPALITY_ID,
    createdBy: 'author-1',
    organizerUserIds: ['author-1'],
    organizerOrgIds: [],
    title: 'Test post',
    body: 'Body',
    category: 'fiesta',
    images: [],
    status: 'approved',
    rejectionReason: null,
    submittedAt: now,
    publishedAt: now,
    updatedAt: now,
    reactionCounts: { like: 0, heart: 0 },
    commentCount: 0,
  });
}

async function seedComment(commentId: string, postId: string, hidden = false): Promise<void> {
  await admin.firestore().doc(`newsComments/${commentId}`).set({
    postId,
    municipalityId: MUNICIPALITY_ID,
    authorUserId: 'user-1',
    body: 'A comment',
    createdAt: new Date(),
    hidden,
  });
}

async function seedReaction(reactionId: string, postId: string): Promise<void> {
  await admin.firestore().doc(`newsReactions/${reactionId}`).set({
    postId,
    municipalityId: MUNICIPALITY_ID,
    userId: 'user-1',
    kind: 'like',
    createdAt: new Date(),
  });
}

async function seedReport(
  reportId: string,
  postId: string,
  status: 'open' | 'dismissed' | 'actioned' = 'open',
): Promise<void> {
  await admin.firestore().doc(`newsReports/${reportId}`).set({
    targetType: 'comment',
    targetId: 'c1',
    postId,
    municipalityId: MUNICIPALITY_ID,
    reporterUserId: 'user-1',
    reason: 'spam',
    createdAt: new Date(),
    status,
    resolvedBy: null,
    resolvedAt: null,
  });
}

interface CallableResult {
  ok: true;
}

async function callDelete(opts: { uid: string | null; data: unknown }): Promise<CallableResult> {
  const wrapped = ft.wrap(deleteNewsPost as unknown as Parameters<typeof ft.wrap>[0]);
  return (await wrapped({
    data: opts.data,
    auth: opts.uid ? { uid: opts.uid, token: {} } : undefined,
  } as unknown as Parameters<typeof wrapped>[0])) as unknown as CallableResult;
}

describe('deleteNewsPost (callable)', () => {
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
      callDelete({ uid: null, data: { postId: 'p1' } }),
    ).rejects.toThrow(/unauthenticated|inici/i);
  });

  it('throws permission-denied for non-admin caller', async () => {
    await seedPost('p1');
    await expect(
      callDelete({ uid: OUTSIDER_UID, data: { postId: 'p1' } }),
    ).rejects.toThrow(/autorizado|permission-denied/i);
  });

  it('throws not-found when post does not exist', async () => {
    await seedMember(ADMIN_UID, 'admin');
    await expect(
      callDelete({ uid: ADMIN_UID, data: { postId: 'nonexistent' } }),
    ).rejects.toThrow(/encontrado|not.?found/i);
  });

  it('admin deletes post with cascade: comments, reactions removed; open reports actioned', async () => {
    await seedMember(ADMIN_UID, 'admin');
    await seedPost('p1');
    await seedComment('c1', 'p1');
    await seedComment('c2', 'p1');
    await seedReaction('p1_u1', 'p1');
    await seedReport('r1', 'p1', 'open');

    const result = await callDelete({ uid: ADMIN_UID, data: { postId: 'p1' } });
    expect(result.ok).toBe(true);

    // Post should be deleted
    const postSnap = await admin.firestore().doc('news/p1').get();
    expect(postSnap.exists).toBe(false);

    // Comments should be deleted
    const c1 = await admin.firestore().doc('newsComments/c1').get();
    const c2 = await admin.firestore().doc('newsComments/c2').get();
    expect(c1.exists).toBe(false);
    expect(c2.exists).toBe(false);

    // Reactions should be deleted
    const r1 = await admin.firestore().doc('newsReactions/p1_u1').get();
    expect(r1.exists).toBe(false);

    // Open reports should be actioned
    const rpt = await admin.firestore().doc('newsReports/r1').get();
    expect(rpt.data()?.status).toBe('actioned');
    expect(rpt.data()?.resolvedBy).toBe(ADMIN_UID);
  });
});
