// Handler test for the resolveNewsReport callable.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../../helpers/firestoreEmulator';
import { resolveNewsReport } from '../../../news/resolveNewsReport';

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

async function seedComment(commentId: string, hidden = false): Promise<void> {
  await admin.firestore().doc(`newsComments/${commentId}`).set({
    postId: 'p1',
    municipalityId: MUNICIPALITY_ID,
    authorUserId: 'user-1',
    body: 'A comment',
    createdAt: new Date(),
    hidden,
  });
}

async function seedReport(
  reportId: string,
  targetId: string,
  status: 'open' | 'dismissed' | 'actioned' = 'open',
): Promise<void> {
  await admin.firestore().doc(`newsReports/${reportId}`).set({
    targetType: 'comment',
    targetId,
    postId: 'p1',
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

async function callResolve(opts: { uid: string | null; data: unknown }): Promise<CallableResult> {
  const wrapped = ft.wrap(resolveNewsReport as unknown as Parameters<typeof ft.wrap>[0]);
  return (await wrapped({
    data: opts.data,
    auth: opts.uid ? { uid: opts.uid, token: {} } : undefined,
  } as unknown as Parameters<typeof wrapped>[0])) as unknown as CallableResult;
}

describe('resolveNewsReport (callable)', () => {
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
      callResolve({ uid: null, data: { reportId: 'r1', action: 'dismiss' } }),
    ).rejects.toThrow(/unauthenticated|inici/i);
  });

  it('throws permission-denied for non-admin caller', async () => {
    await seedComment('c1');
    await seedReport('r1', 'c1');
    await expect(
      callResolve({ uid: OUTSIDER_UID, data: { reportId: 'r1', action: 'dismiss' } }),
    ).rejects.toThrow(/autorizado|permission-denied/i);
  });

  it('admin dismisses report — status=dismissed, comment untouched', async () => {
    await seedMember(ADMIN_UID, 'admin');
    await seedComment('c1');
    await seedReport('r1', 'c1');

    const result = await callResolve({
      uid: ADMIN_UID,
      data: { reportId: 'r1', action: 'dismiss' },
    });
    expect(result.ok).toBe(true);

    const reportSnap = await admin.firestore().doc('newsReports/r1').get();
    expect(reportSnap.data()?.status).toBe('dismissed');
    expect(reportSnap.data()?.resolvedBy).toBe(ADMIN_UID);

    const commentSnap = await admin.firestore().doc('newsComments/c1').get();
    expect(commentSnap.data()?.hidden).toBe(false);
  });

  it('admin removes — status=actioned, comment hidden=true', async () => {
    await seedMember(ADMIN_UID, 'admin');
    await seedComment('c1');
    await seedReport('r1', 'c1');

    await callResolve({ uid: ADMIN_UID, data: { reportId: 'r1', action: 'remove' } });

    const reportSnap = await admin.firestore().doc('newsReports/r1').get();
    expect(reportSnap.data()?.status).toBe('actioned');

    const commentSnap = await admin.firestore().doc('newsComments/c1').get();
    expect(commentSnap.data()?.hidden).toBe(true);
  });

  it('throws failed-precondition when report is already resolved', async () => {
    await seedMember(ADMIN_UID, 'admin');
    await seedComment('c1');
    await seedReport('r1', 'c1', 'dismissed');

    await expect(
      callResolve({ uid: ADMIN_UID, data: { reportId: 'r1', action: 'dismiss' } }),
    ).rejects.toThrow(/resuelto|failed-precondition/i);
  });
});
