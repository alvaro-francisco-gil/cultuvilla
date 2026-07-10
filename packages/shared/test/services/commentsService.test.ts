// Exercises commentsService against the shared in-memory Firestore fake (see
// ../helpers/fakeFirestore) — same harness pattern as newsService.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeFirestoreModule, resetFakeFirestore, fakeStore } from '../helpers/fakeFirestore';

vi.mock('../../src/firebase', () => ({ getDb: () => ({}) }));
vi.mock('firebase/firestore', () => createFakeFirestoreModule());

import {
  addComment,
  deleteComment,
  getComments,
  reactToEntity,
  removeReaction,
  getMyReaction,
} from '../../src/services/commentsService';

describe('commentsService — comments', () => {
  beforeEach(() => {
    resetFakeFirestore();
  });

  it('addComment writes a doc under comments/* with entityKind/entityId/body', async () => {
    const id = await addComment({
      entityKind: 'event',
      entityId: 'e1',
      municipalityId: 'm1',
      authorUserId: 'u1',
      body: 'Nos vemos allí!',
    });
    expect(id).toBeTruthy();
    const snap = fakeStore()[`comments/${id}`];
    expect(snap).toBeDefined();
    expect(snap['entityKind']).toBe('event');
    expect(snap['entityId']).toBe('e1');
    expect(snap['body']).toBe('Nos vemos allí!');
  });

  it('deleteComment removes the comment doc', async () => {
    const id = await addComment({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'X',
    });
    expect(fakeStore()[`comments/${id}`]).toBeDefined();
    await deleteComment(id);
    expect(fakeStore()[`comments/${id}`]).toBeUndefined();
  });

  it('getComments(event, e1) returns only comments for that entity', async () => {
    const id1 = await addComment({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'First',
    });
    const id2 = await addComment({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u2', body: 'Second',
    });
    // Different entityId, same kind
    await addComment({
      entityKind: 'event', entityId: 'e2', municipalityId: 'm1', authorUserId: 'u1', body: 'Other event',
    });
    // Same entityId, different kind
    await addComment({
      entityKind: 'place', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'Other kind',
    });

    const comments = await getComments('event', 'e1');
    const ids = comments.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining([id1, id2]));
    expect(ids.length).toBe(2);
    expect(comments.every((c) => c.entityKind === 'event' && c.entityId === 'e1')).toBe(true);
  });
});

describe('commentsService — reactions', () => {
  beforeEach(() => {
    resetFakeFirestore();
  });

  it('reactToEntity writes a deterministic doc id event_e1_u1', async () => {
    await reactToEntity({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', userId: 'u1', kind: 'like',
    });
    expect(fakeStore()['reactions/event_e1_u1']).toBeDefined();
    expect(fakeStore()['reactions/event_e1_u1']['kind']).toBe('like');
  });

  it('re-reacting with a different kind overwrites (still one doc)', async () => {
    await reactToEntity({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', userId: 'u1', kind: 'like',
    });
    await reactToEntity({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', userId: 'u1', kind: 'heart',
    });
    expect(fakeStore()['reactions/event_e1_u1']['kind']).toBe('heart');
    const reactionDocs = Object.keys(fakeStore()).filter((k) => k.startsWith('reactions/'));
    expect(reactionDocs.length).toBe(1);
  });

  it('removeReaction deletes the reaction doc', async () => {
    await reactToEntity({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', userId: 'u1', kind: 'like',
    });
    expect(fakeStore()['reactions/event_e1_u1']).toBeDefined();
    await removeReaction('event', 'e1', 'u1');
    expect(fakeStore()['reactions/event_e1_u1']).toBeUndefined();
  });

  it('getMyReaction returns the kind when present, then null after removal', async () => {
    await reactToEntity({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', userId: 'u1', kind: 'heart',
    });
    expect(await getMyReaction('event', 'e1', 'u1')).toBe('heart');
    await removeReaction('event', 'e1', 'u1');
    expect(await getMyReaction('event', 'e1', 'u1')).toBeNull();
  });
});
