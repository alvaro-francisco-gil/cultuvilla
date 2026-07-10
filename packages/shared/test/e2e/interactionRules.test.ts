// Firestore Rules e2e tests for the generic /comments and /reactions
// collections shared by all entity kinds (event, festivalPoster, place,
// barrio, organization, news).
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

function validReaction(overrides: Record<string, unknown> = {}) {
  return {
    entityKind: 'event',
    entityId: 'e1',
    municipalityId: 'm1',
    userId: 'alice',
    kind: 'like',
    createdAt: new Date(),
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

// ── /reactions ─────────────────────────────────────────────────────────────

describe('firestore.rules — /reactions/{reactionId}', () => {
  it('a signed-in user creates a reaction at the correct composite id', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(
      setDoc(doc(alice, 'reactions/event_e1_alice'), validReaction({ userId: 'alice' }))
    );
  });

  it('create fails when the doc id does not match entityKind_entityId_uid', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, 'reactions/event_e1_bob'), validReaction({ userId: 'bob' }))
    );
  });

  it('the owner can delete their own reaction', async () => {
    await seed(getEnv(), async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'reactions/event_e1_alice'), validReaction({ userId: 'alice' }));
    });
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(deleteDoc(doc(alice, 'reactions/event_e1_alice')));
  });

  it('a stranger cannot delete another user\'s reaction', async () => {
    await seed(getEnv(), async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'reactions/event_e1_alice'), validReaction({ userId: 'alice' }));
    });
    const bob = asUser(getEnv(), 'bob');
    await assertFails(deleteDoc(doc(bob, 'reactions/event_e1_alice')));
  });
});
