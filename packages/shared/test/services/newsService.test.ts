/* eslint-disable @typescript-eslint/no-non-null-assertion,
                  @typescript-eslint/no-unnecessary-condition,
                  @typescript-eslint/no-redundant-type-constituents,
                  @typescript-eslint/no-dynamic-delete,
                  @typescript-eslint/require-await,
                  @typescript-eslint/restrict-template-expressions */
// This file is a vi.mock-driven in-memory Firestore fake. Strict type-aware
// rules around mock SDK shapes and non-null assertions on test fixtures add
// noise without catching real bugs; the test logic is what matters.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Firebase mocks ────────────────────────────────────────────────────────────
// We build a tiny in-memory Firestore so that the service functions can be
// exercised without a real Firebase project or emulator. The typed refs in
// src/firebase/refs/client call .withConverter() on every collection/doc — our
// mock returns objects with .withConverter that is a no-op so the refs are
// structurally compatible with the rest of the mocked API.

vi.mock('../../src/firebase', () => ({ getDb: () => ({}) }));

type FakeDoc = Record<string, unknown>;
let store: Record<string, FakeDoc> = {};
let idCounter = 0;

function nextId() {
  return `auto${++idCounter}`;
}

function makeFakeDocRef(colId: string, docId: string) {
  const fullId = `${colId}/${docId}`;
  const ref: Record<string, unknown> = {
    id: docId,
    _col: colId,
    _id: fullId,
    get: (field: string) => (store[fullId] ?? {})[field],
  };
  ref['withConverter'] = () => ref;
  return ref as ReturnType<typeof _shape>;
}
function _shape(): { id: string; _col: string; _id: string; get: (f: string) => unknown; withConverter: () => unknown } {
  throw new Error('shape only');
}

function makeFakeCollRef(colId: string) {
  const ref: Record<string, unknown> = { _col: colId };
  ref['withConverter'] = () => ref;
  return ref as { _col: string; withConverter: () => unknown };
}

function makeDocSnap(colId: string, docId: string) {
  const fullId = `${colId}/${docId}`;
  const d = store[fullId];
  return {
    id: docId,
    exists: () => d !== undefined,
    data: () => d ?? {},
    get: (f: string) => (d ?? {})[f],
  };
}

vi.mock('firebase/firestore', () => {
  const serverTimestamp = () => ({ _isServerTimestamp: true, toDate: () => new Date(0) });
  const Timestamp = {
    fromDate: (d: Date) => ({ toDate: () => d, _isTimestamp: true }),
  };

  function collection(_db: unknown, colId: string) {
    return makeFakeCollRef(colId);
  }

  function doc(colOrRef: { _col: string } | unknown, ...rest: string[]) {
    // doc(collection(...)) — one arg, auto id
    if (rest.length === 0) {
      const colId = (colOrRef as { _col: string })._col;
      return makeFakeDocRef(colId, nextId());
    }
    // doc(db, 'col', id) — three args (path style)
    if (rest.length === 2 && typeof rest[0] === 'string' && typeof rest[1] === 'string') {
      return makeFakeDocRef(rest[0], rest[1]);
    }
    // doc(collection(...), id) — two args
    const colId = (colOrRef as { _col: string })._col;
    const id = rest[0];
    return makeFakeDocRef(colId, id);
  }

  async function getDoc(ref: { _col: string; id: string }) {
    return makeDocSnap(ref._col, ref.id);
  }

  async function setDoc(ref: { _id: string }, data: FakeDoc) {
    // Resolve server timestamps
    const resolved: FakeDoc = {};
    for (const [k, v] of Object.entries(data)) {
      if (
        v !== null &&
        typeof v === 'object' &&
        (v as Record<string, unknown>)['_isServerTimestamp']
      ) {
        resolved[k] = { toDate: () => new Date(0), _isTimestamp: true };
      } else {
        resolved[k] = v;
      }
    }
    store[ref._id] = resolved;
  }

  async function updateDoc(ref: { _id: string }, patch: FakeDoc) {
    const existing = store[ref._id] ?? {};
    const resolved: FakeDoc = {};
    for (const [k, v] of Object.entries(patch)) {
      if (
        v !== null &&
        typeof v === 'object' &&
        (v as Record<string, unknown>)['_isServerTimestamp']
      ) {
        resolved[k] = { toDate: () => new Date(0), _isTimestamp: true };
      } else {
        resolved[k] = v;
      }
    }
    store[ref._id] = { ...existing, ...resolved };
  }

  async function deleteDoc(ref: { _id: string }) {
    delete store[ref._id];
  }

  function where(field: string, op: string, value: unknown) {
    return { _type: 'where', field, op, value };
  }

  function orderBy(field: string, dir = 'asc') {
    return { _type: 'orderBy', field, dir };
  }

  function limit(n: number) {
    return { _type: 'limit', n };
  }

  function startAfter(_cursor: unknown) {
    return { _type: 'startAfter', cursor: _cursor };
  }

  function query(colRef: { _col: string }, ...constraints: unknown[]) {
    return { _col: colRef._col, _constraints: constraints };
  }

  async function getDocs(q: { _col: string; _constraints: unknown[] }) {
    const colPrefix = `${q._col}/`;
    let docs = Object.entries(store)
      .filter(([id]) => id.startsWith(colPrefix))
      .map(([id, data]) => {
        const docId = id.slice(colPrefix.length);
        return { id: docId, data: () => data };
      });

    for (const c of q._constraints) {
      const constraint = c as Record<string, unknown>;
      if (constraint['_type'] === 'where') {
        const field = constraint['field'] as string;
        const op = constraint['op'] as string;
        const value = constraint['value'];
        docs = docs.filter((d) => {
          const docData = d.data();
          const fieldVal = docData[field];
          if (op === '==') return fieldVal === value;
          if (op === '!=') return fieldVal !== value;
          if (op === 'array-contains') return Array.isArray(fieldVal) && fieldVal.includes(value);
          return true;
        });
      }
      if (constraint['_type'] === 'limit') {
        const n = constraint['n'] as number;
        docs = docs.slice(0, n);
      }
    }

    return { docs };
  }

  async function getCountFromServer(q: { _col: string; _constraints: unknown[] }) {
    const { docs } = await getDocs(q);
    return { data: () => ({ count: docs.length }) };
  }

  return {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    getDocs,
    getCountFromServer,
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    Timestamp,
  };
});

// ─── Import service under test ─────────────────────────────────────────────────
import {
  createNewsPost,
  getNewsPost,
  getNewsPostsByMunicipality,
  getNewsCountByOrganizer,
  getNewsPostsByOrganizer,
  updateNewsPost,
  reactToPost,
  removeReaction,
  getMyReaction,
  addComment,
  deleteOwnComment,
  getComments,
  reportComment,
  getHomeFeed,
  getAllVillagesFeed,
  getOtherVillagesFeed,
} from '../../src/services/newsService';

// ─── Task 9: CRUD ─────────────────────────────────────────────────────────────

describe('newsService — Task 9: CRUD', () => {
  beforeEach(() => {
    store = {};
    idCounter = 0;
  });

  it('createNewsPost writes a doc with organizerUserIds/organizerOrgIds', async () => {
    const id = await createNewsPost({
      municipalityId: 'm1',
      createdBy: 'u1',
      organizerUserIds: ['u1'],
      organizerOrgIds: [],
      title: 'Fiesta del pueblo',
      body: 'Detalles aquí',
      category: 'fiesta',
    });

    expect(id).toBeTruthy();
    const snap = store[`news/${id}`];
    expect(snap).toBeDefined();
    expect(snap['status']).toBe('pending');
    expect(snap['publishedAt']).toBeNull();
    expect(snap['organizerUserIds']).toEqual(['u1']);
    expect(snap['organizerOrgIds']).toEqual([]);
    expect(snap['reactionCounts']).toEqual({ like: 0, heart: 0 });
    expect(snap['commentCount']).toBe(0);
    expect(snap['municipalityId']).toBe('m1');
    expect(snap['createdBy']).toBe('u1');
    expect(snap['images']).toEqual([]);
    expect(snap['submittedAt']).toBeInstanceOf(Date);
    expect(snap['updatedAt']).toBeInstanceOf(Date);
    // old fields must be absent
    expect(snap['authorUserId']).toBeUndefined();
    expect(snap['authorOrgId']).toBeUndefined();
  });

  it('createNewsPost passes organizerOrgIds when provided', async () => {
    const id = await createNewsPost({
      municipalityId: 'm1',
      createdBy: 'u1',
      organizerUserIds: ['u1'],
      organizerOrgIds: ['org1'],
      title: 'T',
      body: 'B',
      category: 'otro',
    });
    expect(store[`news/${id}`]['organizerOrgIds']).toEqual(['org1']);
  });

  it('getNewsPost returns mapped doc', async () => {
    const id = await createNewsPost({
      municipalityId: 'm1',
      createdBy: 'u1',
      organizerUserIds: ['u1'],
      organizerOrgIds: [],
      title: 'T',
      body: 'B',
      category: 'historia',
    });
    const post = await getNewsPost(id);
    expect(post).not.toBeNull();
    expect(post!.id).toBe(id);
    expect(post!.title).toBe('T');
    expect(post!.status).toBe('pending');
  });

  it('getNewsPost returns null for missing doc', async () => {
    const result = await getNewsPost('nonexistent-id');
    expect(result).toBeNull();
  });

  it('getNewsPostsByMunicipality returns posts for that municipality', async () => {
    await createNewsPost({ municipalityId: 'm1', createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title: 'A', body: 'B', category: 'fiesta' });
    await createNewsPost({ municipalityId: 'm2', createdBy: 'u2', organizerUserIds: ['u2'], organizerOrgIds: [], title: 'C', body: 'D', category: 'otro' });

    const posts = await getNewsPostsByMunicipality('m1');
    expect(posts.length).toBe(1);
    expect(posts[0].municipalityId).toBe('m1');
  });

  it('getNewsPostsByMunicipality filters by status', async () => {
    const id = await createNewsPost({ municipalityId: 'm1', createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title: 'A', body: 'B', category: 'fiesta' });
    // Manually set status to approved
    store[`news/${id}`]['status'] = 'approved';

    await createNewsPost({ municipalityId: 'm1', createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title: 'B', body: 'C', category: 'fiesta' });

    const approved = await getNewsPostsByMunicipality('m1', { status: 'approved' });
    expect(approved.length).toBe(1);
    expect(approved[0].id).toBe(id);
  });

  it('getNewsCountByOrganizer counts posts where user is in organizerUserIds', async () => {
    await createNewsPost({ municipalityId: 'm1', createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title: 'A', body: 'B', category: 'fiesta' });
    await createNewsPost({ municipalityId: 'm2', createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title: 'C', body: 'D', category: 'otro' });
    await createNewsPost({ municipalityId: 'm1', createdBy: 'u2', organizerUserIds: ['u2'], organizerOrgIds: [], title: 'E', body: 'F', category: 'historia' });

    expect(await getNewsCountByOrganizer('u1')).toBe(2);
    expect(await getNewsCountByOrganizer('u2')).toBe(1);
    expect(await getNewsCountByOrganizer('nobody')).toBe(0);
  });

  it('getNewsPostsByOrganizer returns posts where user is in organizerUserIds', async () => {
    await createNewsPost({ municipalityId: 'm1', createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title: 'A', body: 'B', category: 'fiesta' });
    await createNewsPost({ municipalityId: 'm2', createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title: 'C', body: 'D', category: 'otro' });
    await createNewsPost({ municipalityId: 'm1', createdBy: 'u2', organizerUserIds: ['u2'], organizerOrgIds: [], title: 'E', body: 'F', category: 'historia' });

    const mine = await getNewsPostsByOrganizer('u1');
    expect(mine.length).toBe(2);
    expect(mine.every((p) => p.organizerUserIds.includes('u1'))).toBe(true);
    expect(await getNewsPostsByOrganizer('nobody')).toEqual([]);
  });

  it('getNewsPostsByOrganizer respects the limit option', async () => {
    await createNewsPost({ municipalityId: 'm1', createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title: 'A', body: 'B', category: 'fiesta' });
    await createNewsPost({ municipalityId: 'm1', createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title: 'C', body: 'D', category: 'otro' });
    await createNewsPost({ municipalityId: 'm1', createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title: 'E', body: 'F', category: 'historia' });

    expect((await getNewsPostsByOrganizer('u1', { limit: 2 })).length).toBe(2);
  });

  it('updateNewsPost updates allowed fields', async () => {
    const id = await createNewsPost({ municipalityId: 'm1', createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title: 'Old', body: 'B', category: 'fiesta' });
    await updateNewsPost(id, { title: 'New title', body: 'New body' });
    const snap = store[`news/${id}`];
    expect(snap['title']).toBe('New title');
    expect(snap['body']).toBe('New body');
  });

  it('updateNewsPost throws when trying to modify forbidden field "status"', async () => {
    const id = await createNewsPost({ municipalityId: 'm1', createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title: 'T', body: 'B', category: 'fiesta' });
    await expect(
      updateNewsPost(id, { title: 'X' })
        .then(() => {
          // @ts-expect-error intentionally passing forbidden field
          return updateNewsPost(id, { status: 'approved' });
        })
    ).rejects.toThrow(/status/);
  });
});

describe('getApprovedNewsPostsByOrganizer', () => {
  it('returns only approved posts where the user is an organizer, newest first', async () => {
    store = {};
    store['news/n1'] = {
      organizerUserIds: ['u1'], status: 'approved',
      submittedAt: new Date('2026-01-02'),
    };
    store['news/n2'] = {
      organizerUserIds: ['u1'], status: 'pending',
      submittedAt: new Date('2026-01-03'),
    };
    store['news/n3'] = {
      organizerUserIds: ['u1'], status: 'approved',
      submittedAt: new Date('2026-01-01'),
    };
    store['news/n4'] = {
      organizerUserIds: ['other'], status: 'approved',
      submittedAt: new Date('2026-01-04'),
    };
    const { getApprovedNewsPostsByOrganizer } = await import(
      '../../src/services/newsService'
    );
    const res = await getApprovedNewsPostsByOrganizer('u1');
    expect(res.map((p) => p.id)).toEqual(['n1', 'n3']);
  });
});

// ─── Task 5: Reactions ─────────────────────────────────────────────────────────

describe('newsService — Task 5: Reactions', () => {
  beforeEach(() => {
    store = {};
    idCounter = 0;
  });

  it('reactToPost writes a doc with deterministic id postId_userId', async () => {
    await reactToPost('p1', 'u1', 'm1', 'like');
    expect(store['newsReactions/p1_u1']).toBeDefined();
    expect(store['newsReactions/p1_u1']['kind']).toBe('like');
  });

  it('calling reactToPost twice with different kinds overwrites (one reaction per user)', async () => {
    await reactToPost('p1', 'u1', 'm1', 'like');
    await reactToPost('p1', 'u1', 'm1', 'heart');
    expect(store['newsReactions/p1_u1']['kind']).toBe('heart');
    // Still only one doc
    const reactionDocs = Object.keys(store).filter((k) => k.startsWith('newsReactions/'));
    expect(reactionDocs.length).toBe(1);
  });

  it('removeReaction deletes the reaction doc', async () => {
    await reactToPost('p1', 'u1', 'm1', 'like');
    expect(store['newsReactions/p1_u1']).toBeDefined();
    await removeReaction('p1', 'u1');
    expect(store['newsReactions/p1_u1']).toBeUndefined();
  });

  it('getMyReaction returns the kind if the reaction exists', async () => {
    await reactToPost('p1', 'u1', 'm1', 'heart');
    const kind = await getMyReaction('p1', 'u1');
    expect(kind).toBe('heart');
  });

  it('getMyReaction returns null when no reaction exists', async () => {
    const kind = await getMyReaction('p1', 'u99');
    expect(kind).toBeNull();
  });
});

// ─── Task 6: Comments + Reports ───────────────────────────────────────────────

describe('newsService — Task 6: Comments and Reports', () => {
  beforeEach(() => {
    store = {};
    idCounter = 0;
  });

  it('addComment writes a comment with hidden=false', async () => {
    const id = await addComment({
      postId: 'p1',
      municipalityId: 'm1',
      authorUserId: 'u1',
      body: 'Hola pueblo!',
    });
    expect(id).toBeTruthy();
    const snap = store[`newsComments/${id}`];
    expect(snap['hidden']).toBe(false);
    expect(snap['body']).toBe('Hola pueblo!');
    expect(snap['postId']).toBe('p1');
  });

  it('deleteOwnComment removes the comment doc', async () => {
    const id = await addComment({ postId: 'p1', municipalityId: 'm1', authorUserId: 'u1', body: 'X' });
    expect(store[`newsComments/${id}`]).toBeDefined();
    await deleteOwnComment(id);
    expect(store[`newsComments/${id}`]).toBeUndefined();
  });

  it('getComments returns visible comments for a post', async () => {
    const id1 = await addComment({ postId: 'p1', municipalityId: 'm1', authorUserId: 'u1', body: 'First' });
    const id2 = await addComment({ postId: 'p1', municipalityId: 'm1', authorUserId: 'u2', body: 'Second' });
    // A hidden comment (manually set)
    const id3 = await addComment({ postId: 'p1', municipalityId: 'm1', authorUserId: 'u3', body: 'Hidden' });
    store[`newsComments/${id3}`]['hidden'] = true;
    // A comment on another post
    await addComment({ postId: 'p2', municipalityId: 'm1', authorUserId: 'u1', body: 'Other post' });

    const comments = await getComments('p1');
    const ids = comments.map((c) => c.id);
    expect(ids).toContain(id1);
    expect(ids).toContain(id2);
    expect(ids).not.toContain(id3);
    expect(comments.every((c) => c.postId === 'p1')).toBe(true);
    expect(comments.every((c) => !c.hidden)).toBe(true);
  });

  it('reportComment writes a report with status=open', async () => {
    const id = await reportComment({
      commentId: 'c1',
      postId: 'p1',
      municipalityId: 'm1',
      reporterUserId: 'u1',
      reason: 'spam',
    });
    expect(id).toBeTruthy();
    const snap = store[`newsReports/${id}`];
    expect(snap['status']).toBe('open');
    expect(snap['targetType']).toBe('comment');
    expect(snap['reporterUserId']).toBe('u1');
    expect(snap['resolvedBy']).toBeNull();
    expect(snap['resolvedAt']).toBeNull();
  });
});

// ─── Task 7: Feed queries ──────────────────────────────────────────────────────

describe('newsService — Task 7: Feed queries', () => {
  beforeEach(() => {
    store = {};
    idCounter = 0;
  });

  async function seedApprovedPost(municipalityId: string, title: string) {
    const id = await createNewsPost({ municipalityId, createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title, body: 'B', category: 'fiesta' });
    store[`news/${id}`]['status'] = 'approved';
    store[`news/${id}`]['publishedAt'] = new Date(2024, 1, 1);
    return id;
  }

  it('getHomeFeed returns only approved posts for the home municipality', async () => {
    const id1 = await seedApprovedPost('m1', 'Home 1');
    const id2 = await seedApprovedPost('m1', 'Home 2');
    // pending post in home
    await createNewsPost({ municipalityId: 'm1', createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title: 'Pending', body: 'B', category: 'fiesta' });
    // approved post in other municipality
    await seedApprovedPost('m2', 'Other');

    const feed = await getHomeFeed('m1');
    const ids = feed.map((p) => p.id);
    expect(ids).toContain(id1);
    expect(ids).toContain(id2);
    expect(feed.every((p) => p.municipalityId === 'm1')).toBe(true);
    expect(feed.every((p) => p.status === 'approved')).toBe(true);
  });

  it('getAllVillagesFeed returns approved posts across every municipality', async () => {
    const id1 = await seedApprovedPost('m1', 'Home');
    const id2 = await seedApprovedPost('m2', 'Other');
    // pending post anywhere should be excluded
    await createNewsPost({ municipalityId: 'm1', createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title: 'Pending', body: 'B', category: 'fiesta' });

    const feed = await getAllVillagesFeed();
    const ids = feed.map((p) => p.id);
    expect(ids).toContain(id1);
    expect(ids).toContain(id2);
    expect(feed.every((p) => p.status === 'approved')).toBe(true);
  });

  it('getOtherVillagesFeed returns approved posts excluding home municipality', async () => {
    await seedApprovedPost('m1', 'Home post');
    const id2 = await seedApprovedPost('m2', 'Other 1');
    const id3 = await seedApprovedPost('m3', 'Other 2');
    // pending in m2 should be excluded
    await createNewsPost({ municipalityId: 'm2', createdBy: 'u1', organizerUserIds: ['u1'], organizerOrgIds: [], title: 'Pending m2', body: 'B', category: 'fiesta' });

    const feed = await getOtherVillagesFeed('m1');
    const ids = feed.map((p) => p.id);
    expect(ids).toContain(id2);
    expect(ids).toContain(id3);
    expect(ids.every((id) => id !== 'home-post-id')).toBe(true);
    expect(feed.every((p) => p.municipalityId !== 'm1')).toBe(true);
    expect(feed.every((p) => p.status === 'approved')).toBe(true);
  });
});
