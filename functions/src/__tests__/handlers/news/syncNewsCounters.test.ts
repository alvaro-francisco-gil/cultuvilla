// Handler tests for syncNewsReactionCounts and syncNewsCommentCount triggers.
// Uses firebase-functions-test to wrap the onDocumentWritten triggers and
// invokes them against the Firestore emulator.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../../helpers/firestoreEmulator';
import { syncNewsReactionCounts } from '../../../news/syncNewsReactionCounts';
import { syncNewsCommentCount } from '../../../news/syncNewsCommentCount';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });

const POST_ID = 'post-1';
const MUN_ID = 'mun-1';

async function seedPost(): Promise<void> {
  await admin.firestore().doc(`news/${POST_ID}`).set({
    municipalityId: MUN_ID,
    authorUserId: 'user-1',
    title: 'Test',
    body: 'Body',
    category: 'fiesta',
    images: [],
    status: 'approved',
    rejectionReason: null,
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'user-1',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    reactionCounts: { like: 0, heart: 0 },
    commentCount: 0,
  });
}

// ─── Reaction trigger helpers ───────────────────────────────────────────────

async function invokeReactionCreate(reactionId: string, kind: 'like' | 'heart'): Promise<void> {
  const data = { postId: POST_ID, municipalityId: MUN_ID, userId: 'u1', kind, createdAt: new Date() };
  const after = ft.firestore.makeDocumentSnapshot(data, `newsReactions/${reactionId}`);
  const before = ft.firestore.makeDocumentSnapshot({}, `newsReactions/${reactionId}`);
  const change = ft.makeChange(before, after);
  const wrapped = ft.wrap(syncNewsReactionCounts as unknown as Parameters<typeof ft.wrap>[0]);
  await wrapped({ data: change, params: { reactionId } } as unknown as Parameters<typeof wrapped>[0]);
}

async function invokeReactionDelete(reactionId: string, kind: 'like' | 'heart'): Promise<void> {
  const data = { postId: POST_ID, municipalityId: MUN_ID, userId: 'u1', kind };
  const before = ft.firestore.makeDocumentSnapshot(data, `newsReactions/${reactionId}`);
  const after = ft.firestore.makeDocumentSnapshot({}, `newsReactions/${reactionId}`);
  const change = ft.makeChange(before, after);
  const wrapped = ft.wrap(syncNewsReactionCounts as unknown as Parameters<typeof ft.wrap>[0]);
  await wrapped({ data: change, params: { reactionId } } as unknown as Parameters<typeof wrapped>[0]);
}

async function invokeReactionUpdate(
  reactionId: string,
  oldKind: 'like' | 'heart',
  newKind: 'like' | 'heart',
): Promise<void> {
  const beforeData = { postId: POST_ID, municipalityId: MUN_ID, userId: 'u1', kind: oldKind };
  const afterData = { postId: POST_ID, municipalityId: MUN_ID, userId: 'u1', kind: newKind };
  const before = ft.firestore.makeDocumentSnapshot(beforeData, `newsReactions/${reactionId}`);
  const after = ft.firestore.makeDocumentSnapshot(afterData, `newsReactions/${reactionId}`);
  const change = ft.makeChange(before, after);
  const wrapped = ft.wrap(syncNewsReactionCounts as unknown as Parameters<typeof ft.wrap>[0]);
  await wrapped({ data: change, params: { reactionId } } as unknown as Parameters<typeof wrapped>[0]);
}

async function getReactionCounts(): Promise<{ like: number; heart: number }> {
  const snap = await admin.firestore().doc(`news/${POST_ID}`).get();
  return snap.data()?.reactionCounts as { like: number; heart: number };
}

// ─── Comment trigger helpers ─────────────────────────────────────────────────

async function invokeCommentCreate(commentId: string, hidden: boolean): Promise<void> {
  const data = { postId: POST_ID, municipalityId: MUN_ID, authorUserId: 'u1', body: 'hi', hidden };
  const after = ft.firestore.makeDocumentSnapshot(data, `newsComments/${commentId}`);
  const before = ft.firestore.makeDocumentSnapshot({}, `newsComments/${commentId}`);
  const change = ft.makeChange(before, after);
  const wrapped = ft.wrap(syncNewsCommentCount as unknown as Parameters<typeof ft.wrap>[0]);
  await wrapped({ data: change, params: { commentId } } as unknown as Parameters<typeof wrapped>[0]);
}

async function invokeCommentDelete(commentId: string, hidden: boolean): Promise<void> {
  const data = { postId: POST_ID, municipalityId: MUN_ID, authorUserId: 'u1', body: 'hi', hidden };
  const before = ft.firestore.makeDocumentSnapshot(data, `newsComments/${commentId}`);
  const after = ft.firestore.makeDocumentSnapshot({}, `newsComments/${commentId}`);
  const change = ft.makeChange(before, after);
  const wrapped = ft.wrap(syncNewsCommentCount as unknown as Parameters<typeof ft.wrap>[0]);
  await wrapped({ data: change, params: { commentId } } as unknown as Parameters<typeof wrapped>[0]);
}

async function invokeCommentUpdate(
  commentId: string,
  hiddenBefore: boolean,
  hiddenAfter: boolean,
): Promise<void> {
  const beforeData = { postId: POST_ID, municipalityId: MUN_ID, authorUserId: 'u1', body: 'hi', hidden: hiddenBefore };
  const afterData = { postId: POST_ID, municipalityId: MUN_ID, authorUserId: 'u1', body: 'hi', hidden: hiddenAfter };
  const before = ft.firestore.makeDocumentSnapshot(beforeData, `newsComments/${commentId}`);
  const after = ft.firestore.makeDocumentSnapshot(afterData, `newsComments/${commentId}`);
  const change = ft.makeChange(before, after);
  const wrapped = ft.wrap(syncNewsCommentCount as unknown as Parameters<typeof ft.wrap>[0]);
  await wrapped({ data: change, params: { commentId } } as unknown as Parameters<typeof wrapped>[0]);
}

async function getCommentCount(): Promise<number> {
  const snap = await admin.firestore().doc(`news/${POST_ID}`).get();
  return snap.data()?.commentCount as number;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('syncNewsReactionCounts trigger', () => {
  beforeAll(async () => {
    await resetEmulators();
  });

  beforeEach(async () => {
    await resetEmulators();
    await seedPost();
  });

  afterAll(() => {
    ft.cleanup();
  });

  it('two like reactions + one heart → {like:2, heart:1}', async () => {
    await invokeReactionCreate('r1', 'like');
    await invokeReactionCreate('r2', 'like');
    await invokeReactionCreate('r3', 'heart');

    const counts = await getReactionCounts();
    expect(counts.like).toBe(2);
    expect(counts.heart).toBe(1);
  });

  it('deleting a like decrements to {like:1, heart:1}', async () => {
    await invokeReactionCreate('r1', 'like');
    await invokeReactionCreate('r2', 'like');
    await invokeReactionCreate('r3', 'heart');
    await invokeReactionDelete('r1', 'like');

    const counts = await getReactionCounts();
    expect(counts.like).toBe(1);
    expect(counts.heart).toBe(1);
  });

  it('switching reaction kind from like to heart → {like:0, heart:2}', async () => {
    await invokeReactionCreate('r1', 'like');
    await invokeReactionCreate('r2', 'heart');
    await invokeReactionUpdate('r1', 'like', 'heart');

    const counts = await getReactionCounts();
    expect(counts.like).toBe(0);
    expect(counts.heart).toBe(2);
  });
});

describe('syncNewsCommentCount trigger', () => {
  beforeAll(async () => {
    await resetEmulators();
  });

  beforeEach(async () => {
    await resetEmulators();
    await seedPost();
  });

  afterAll(() => {
    ft.cleanup();
  });

  it('two visible comments → commentCount=2', async () => {
    await invokeCommentCreate('c1', false);
    await invokeCommentCreate('c2', false);

    expect(await getCommentCount()).toBe(2);
  });

  it('hiding a comment (false→true) decrements to commentCount=1', async () => {
    await invokeCommentCreate('c1', false);
    await invokeCommentCreate('c2', false);
    await invokeCommentUpdate('c1', false, true);

    expect(await getCommentCount()).toBe(1);
  });

  it('deleting a visible comment decrements; deleting hidden comment is no-op', async () => {
    await invokeCommentCreate('c1', false);
    await invokeCommentCreate('c2', true); // hidden from start
    await invokeCommentDelete('c1', false); // visible delete → decrement
    expect(await getCommentCount()).toBe(0);

    await invokeCommentDelete('c2', true); // hidden delete → no-op
    expect(await getCommentCount()).toBe(0);
  });
});
