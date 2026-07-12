// Firestore Rules e2e tests for the generic /comments collection shared by
// all entity kinds (event, festivalPoster, place, barrio, organization,
// news), plus the function-owned `readCount` counter that every entity
// carries (written only by the recordEntityView callable via the admin SDK,
// which bypasses these rules).
import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, asAdmin, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

// ── helpers ──────────────────────────────────────────────────────────────────

async function seedMember(
  municipalityId: string,
  userId: string,
  extra: Record<string, unknown> = {}
) {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${municipalityId}/members/${userId}`), {
      role: 'user',
      joinedAt: new Date(),
      profileAnswers: {},
      profileCompletedAt: null,
      trustedNewsAuthor: false,
      ...extra,
    });
  });
}

async function seedComment(
  commentId: string,
  authorUserId: string,
  municipalityId: string,
  extra: Record<string, unknown> = {}
) {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `comments/${commentId}`), {
      entityKind: 'event',
      entityId: 'e1',
      municipalityId,
      authorUserId,
      body: 'Hola!',
      createdAt: new Date(),
      ...extra,
    });
  });
}

function validComment(overrides: Record<string, unknown> = {}) {
  return {
    entityKind: 'event',
    entityId: 'e1',
    municipalityId: 'm1',
    authorUserId: 'alice',
    body: 'Hola!',
    createdAt: new Date(),
    ...overrides,
  };
}

// A full, schema-valid event payload (mirrors isValidEventCreate keys) used
// to exercise the function-owned `readCount` guard — readCount is written
// only by the recordEntityView callable via the admin SDK, so every client
// path here goes through the normal rules.
function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Fiesta',
    description: 'desc',
    startDate: new Date('2026-07-01'),
    endDate: null,
    endBoundary: new Date('2026-07-01'),
    location: { coordinates: { lat: 40.0, lng: -3.0 }, displayName: 'Plaza Mayor' },
    imageURL: null,
    maxAttendees: null,
    telephoneRequired: false,
    requiresPayment: false,
    status: 'published',
    organizerUserIds: ['alice'],
    organizerOrgIds: [],
    createdBy: 'alice',
    createdAt: new Date(),
    updatedAt: new Date(),
    municipalityId: 'm1',
    villageName: 'Villa',
    villageCoverImage: null,
    villageCoordinates: null,
    commentCount: 0,
    readCount: 0,
    ...overrides,
  };
}

// ── /comments ──────────────────────────────────────────────────────────────

describe('firestore.rules — /comments/{commentId}', () => {
  it('anyone (unauthenticated) can read a seeded comment', async () => {
    await seedComment('c1', 'alice', 'm1');
    const anon = asAnon(getEnv());
    await assertSucceeds(getDoc(doc(anon, 'comments/c1')));
  });

  it('a signed-in user with no village membership can create their own comment', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(setDoc(doc(alice, 'comments/c1'), validComment()));
  });

  it('create fails when authorUserId does not match the caller uid', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, 'comments/c1'), validComment({ authorUserId: 'bob' }))
    );
  });

  it('create fails when unauthenticated', async () => {
    const anon = asAnon(getEnv());
    await assertFails(setDoc(doc(anon, 'comments/c1'), validComment()));
  });

  it('create fails when body is empty', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, 'comments/c1'), validComment({ body: '' }))
    );
  });

  it('create fails when an extra key is present', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, 'comments/c1'), validComment({ extra: 'nope' }))
    );
  });

  it('update always fails — comments are immutable', async () => {
    await seedComment('c1', 'alice', 'm1');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(updateDoc(doc(alice, 'comments/c1'), { body: 'edited' }));
  });

  it('the owning author can delete their own comment', async () => {
    await seedComment('c1', 'alice', 'm1');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(deleteDoc(doc(alice, 'comments/c1')));
  });

  it('a village admin of the comment municipality can delete it', async () => {
    await seedComment('c1', 'alice', 'm1');
    await seedMember('m1', 'bob', { role: 'admin' });
    const bob = asUser(getEnv(), 'bob');
    await assertSucceeds(deleteDoc(doc(bob, 'comments/c1')));
  });

  it('an app admin can delete any comment', async () => {
    await seedComment('c1', 'alice', 'm1');
    const sadmin = await asAdmin(getEnv(), 'sadmin');
    await assertSucceeds(deleteDoc(doc(sadmin, 'comments/c1')));
  });

  it('an unrelated signed-in user cannot delete someone else\'s comment', async () => {
    await seedComment('c1', 'alice', 'm1');
    const carol = asUser(getEnv(), 'carol');
    await assertFails(deleteDoc(doc(carol, 'comments/c1')));
  });
});

// ── readCount (function-owned) ──────────────────────────────────────────────
//
// readCount is written only by the recordEntityView Cloud Function via the
// admin SDK, which bypasses these rules entirely — so there is no client
// write path to allow. These assertions pin that: creation requires
// readCount == 0, and no client update may touch it, even alongside an
// otherwise-valid change.

describe('firestore.rules — readCount is function-owned', () => {
  it('a valid entity with readCount: 0 and no reactionCounts is accepted', async () => {
    await seedMember('m1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(setDoc(doc(alice, 'events/e1'), validEvent()));
  });

  it('creating an entity with a nonzero readCount is denied', async () => {
    await seedMember('m1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, 'events/e1'), validEvent({ readCount: 3 }))
    );
  });

  it('a client update touching readCount is denied, even for the owner', async () => {
    await seedMember('m1', 'alice');
    await seed(getEnv(), async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'events/e1'), validEvent());
    });
    const alice = asUser(getEnv(), 'alice');
    await assertFails(updateDoc(doc(alice, 'events/e1'), { readCount: 99 }));
  });
});
