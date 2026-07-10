// Trigger tests for syncEntityCommentCount / syncEntityReactionCounts. Drives
// the handlers via firebase-functions-test's wrap()/makeChange() against the
// Firestore emulator (admin SDK env is wired up in setup/admin.setup.ts).
// Modeled on functions/src/__tests__/handlers/syncPersonDenormalization.test.ts.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../../helpers/firestoreEmulator';
import {
  syncEntityCommentCount,
  syncEntityReactionCounts,
} from '../../../interaction/syncEntityInteractionCounts';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });
const wrappedComment = ft.wrap(syncEntityCommentCount);
const wrappedReaction = ft.wrap(syncEntityReactionCounts);

const MUNICIPALITY_ID = 'm1';

interface CommentShape {
  entityKind: string;
  entityId: string;
  municipalityId: string;
  authorId: string;
  text: string;
}

interface ReactionShape {
  entityKind: string;
  entityId: string;
  municipalityId: string;
  authorId: string;
  kind: string;
}

function comment(overrides: Partial<CommentShape> = {}): CommentShape {
  return {
    entityKind: 'event',
    entityId: 'e1',
    municipalityId: MUNICIPALITY_ID,
    authorId: 'user-1',
    text: 'hola',
    ...overrides,
  };
}

function reaction(overrides: Partial<ReactionShape> = {}): ReactionShape {
  return {
    entityKind: 'event',
    entityId: 'e1',
    municipalityId: MUNICIPALITY_ID,
    authorId: 'user-1',
    kind: 'like',
    ...overrides,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value ? (value as Record<string, unknown>) : {};
}

async function fireCommentTrigger(
  before: CommentShape | null,
  after: CommentShape | null,
  commentId = 'comment-1',
): Promise<void> {
  const beforeSnap = ft.firestore.makeDocumentSnapshot(asRecord(before), `comments/${commentId}`);
  const afterSnap = ft.firestore.makeDocumentSnapshot(asRecord(after), `comments/${commentId}`);
  const change = ft.makeChange(beforeSnap, afterSnap);
  await wrappedComment({ data: change, params: { commentId } } as unknown as Parameters<
    typeof wrappedComment
  >[0]);
}

async function fireReactionTrigger(
  before: ReactionShape | null,
  after: ReactionShape | null,
  reactionId = 'reaction-1',
): Promise<void> {
  const beforeSnap = ft.firestore.makeDocumentSnapshot(
    asRecord(before),
    `reactions/${reactionId}`,
  );
  const afterSnap = ft.firestore.makeDocumentSnapshot(asRecord(after), `reactions/${reactionId}`);
  const change = ft.makeChange(beforeSnap, afterSnap);
  await wrappedReaction({ data: change, params: { reactionId } } as unknown as Parameters<
    typeof wrappedReaction
  >[0]);
}

async function seedEvent(id: string, extra: Record<string, unknown> = {}): Promise<void> {
  await admin.firestore().doc(`events/${id}`).set({ commentCount: 0, reactionCounts: {}, ...extra });
}

async function seedNews(id: string, extra: Record<string, unknown> = {}): Promise<void> {
  await admin.firestore().doc(`news/${id}`).set({ commentCount: 0, reactionCounts: {}, ...extra });
}

async function seedPlace(id: string, extra: Record<string, unknown> = {}): Promise<void> {
  await admin
    .firestore()
    .doc(`municipalities/${MUNICIPALITY_ID}/places/${id}`)
    .set({ commentCount: 0, reactionCounts: {}, ...extra });
}

async function seedBarrio(id: string, extra: Record<string, unknown> = {}): Promise<void> {
  await admin
    .firestore()
    .doc(`municipalities/${MUNICIPALITY_ID}/barrios/${id}`)
    .set({ commentCount: 0, reactionCounts: {}, ...extra });
}

async function seedOrganization(id: string, extra: Record<string, unknown> = {}): Promise<void> {
  await admin
    .firestore()
    .doc(`organizations/${id}`)
    .set({ commentCount: 0, reactionCounts: {}, ...extra });
}

async function seedFestivalPoster(id: string, extra: Record<string, unknown> = {}): Promise<void> {
  await admin
    .firestore()
    .doc(`festivalPosters/${id}`)
    .set({ commentCount: 0, reactionCounts: {}, ...extra });
}

beforeAll(async () => {
  await resetEmulators();
});

beforeEach(async () => {
  await resetEmulators();
});

afterAll(() => {
  ft.cleanup();
});

describe('syncEntityCommentCount', () => {
  it('increments the parent commentCount on comment create', async () => {
    await seedEvent('e1');
    await fireCommentTrigger(null, comment());

    const eventDoc = await admin.firestore().doc('events/e1').get();
    expect(eventDoc.get('commentCount')).toBe(1);
  });

  it('decrements the parent commentCount on comment delete', async () => {
    await seedEvent('e1', { commentCount: 1 });
    await fireCommentTrigger(comment(), null);

    const eventDoc = await admin.firestore().doc('events/e1').get();
    expect(eventDoc.get('commentCount')).toBe(0);
  });

  it('routes place comments to municipalities/{municipalityId}/places/{entityId}', async () => {
    await seedPlace('p1');
    await fireCommentTrigger(null, comment({ entityKind: 'place', entityId: 'p1' }));

    const placeDoc = await admin
      .firestore()
      .doc(`municipalities/${MUNICIPALITY_ID}/places/p1`)
      .get();
    expect(placeDoc.get('commentCount')).toBe(1);
  });

  it('routes barrio comments to municipalities/{municipalityId}/barrios/{entityId}', async () => {
    await seedBarrio('b1');
    await fireCommentTrigger(null, comment({ entityKind: 'barrio', entityId: 'b1' }));

    const barrioDoc = await admin
      .firestore()
      .doc(`municipalities/${MUNICIPALITY_ID}/barrios/b1`)
      .get();
    expect(barrioDoc.get('commentCount')).toBe(1);
  });

  it('routes news comments to news/{entityId}', async () => {
    await seedNews('n1');
    await fireCommentTrigger(null, comment({ entityKind: 'news', entityId: 'n1' }));

    const newsDoc = await admin.firestore().doc('news/n1').get();
    expect(newsDoc.get('commentCount')).toBe(1);
  });

  it('routes organization comments to organizations/{entityId}', async () => {
    await seedOrganization('o1');
    await fireCommentTrigger(null, comment({ entityKind: 'organization', entityId: 'o1' }));

    const orgDoc = await admin.firestore().doc('organizations/o1').get();
    expect(orgDoc.get('commentCount')).toBe(1);
  });

  it('routes festivalPoster comments to festivalPosters/{entityId}', async () => {
    await seedFestivalPoster('fp1');
    await fireCommentTrigger(null, comment({ entityKind: 'festivalPoster', entityId: 'fp1' }));

    const festivalPosterDoc = await admin.firestore().doc('festivalPosters/fp1').get();
    expect(festivalPosterDoc.get('commentCount')).toBe(1);
  });

  it('no-ops without throwing for an unknown entityKind', async () => {
    await expect(
      fireCommentTrigger(null, comment({ entityKind: 'unknownKind', entityId: 'x1' })),
    ).resolves.not.toThrow();
  });

  it('swallows NOT_FOUND when the parent entity does not exist', async () => {
    // No seed for events/does-not-exist.
    await expect(
      fireCommentTrigger(null, comment({ entityKind: 'event', entityId: 'does-not-exist' })),
    ).resolves.not.toThrow();
  });
});

describe('syncEntityReactionCounts', () => {
  it('increments reactionCounts.<kind> on reaction create', async () => {
    await seedEvent('e1');
    await fireReactionTrigger(null, reaction({ kind: 'like' }));

    const eventDoc = await admin.firestore().doc('events/e1').get();
    expect(eventDoc.get('reactionCounts.like')).toBe(1);
  });

  it('decrements reactionCounts.<kind> on reaction delete', async () => {
    await seedEvent('e1', { reactionCounts: { like: 1 } });
    await fireReactionTrigger(reaction({ kind: 'like' }), null);

    const eventDoc = await admin.firestore().doc('events/e1').get();
    expect(eventDoc.get('reactionCounts.like')).toBe(0);
  });

  it('moves the count from the old kind to the new kind on a reaction kind change', async () => {
    await seedEvent('e1', { reactionCounts: { like: 1 } });
    await fireReactionTrigger(reaction({ kind: 'like' }), reaction({ kind: 'heart' }));

    const eventDoc = await admin.firestore().doc('events/e1').get();
    expect(eventDoc.get('reactionCounts.like')).toBe(0);
    expect(eventDoc.get('reactionCounts.heart')).toBe(1);
  });

  it('no-ops when the kind is unchanged', async () => {
    await seedEvent('e1', { reactionCounts: { like: 1 } });
    await fireReactionTrigger(reaction({ kind: 'like' }), reaction({ kind: 'like' }));

    const eventDoc = await admin.firestore().doc('events/e1').get();
    expect(eventDoc.get('reactionCounts.like')).toBe(1);
  });

  it('routes place reactions to municipalities/{municipalityId}/places/{entityId}', async () => {
    await seedPlace('p1');
    await fireReactionTrigger(
      null,
      reaction({ entityKind: 'place', entityId: 'p1', kind: 'like' }),
    );

    const placeDoc = await admin
      .firestore()
      .doc(`municipalities/${MUNICIPALITY_ID}/places/p1`)
      .get();
    expect(placeDoc.get('reactionCounts.like')).toBe(1);
  });

  it('routes organization reactions to organizations/{entityId}', async () => {
    await seedOrganization('o1');
    await fireReactionTrigger(
      null,
      reaction({ entityKind: 'organization', entityId: 'o1', kind: 'like' }),
    );

    const orgDoc = await admin.firestore().doc('organizations/o1').get();
    expect(orgDoc.get('reactionCounts.like')).toBe(1);
  });

  it('routes festivalPoster reactions to festivalPosters/{entityId}', async () => {
    await seedFestivalPoster('fp1');
    await fireReactionTrigger(
      null,
      reaction({ entityKind: 'festivalPoster', entityId: 'fp1', kind: 'like' }),
    );

    const festivalPosterDoc = await admin.firestore().doc('festivalPosters/fp1').get();
    expect(festivalPosterDoc.get('reactionCounts.like')).toBe(1);
  });

  it('routes barrio reactions to municipalities/{municipalityId}/barrios/{entityId}', async () => {
    await seedBarrio('b1');
    await fireReactionTrigger(
      null,
      reaction({ entityKind: 'barrio', entityId: 'b1', kind: 'like' }),
    );

    const barrioDoc = await admin
      .firestore()
      .doc(`municipalities/${MUNICIPALITY_ID}/barrios/b1`)
      .get();
    expect(barrioDoc.get('reactionCounts.like')).toBe(1);
  });

  it('routes news reactions to news/{entityId}', async () => {
    await seedNews('n1');
    await fireReactionTrigger(
      null,
      reaction({ entityKind: 'news', entityId: 'n1', kind: 'heart' }),
    );

    const newsDoc = await admin.firestore().doc('news/n1').get();
    expect(newsDoc.get('reactionCounts.heart')).toBe(1);
  });

  it('no-ops without throwing for an unknown entityKind', async () => {
    await expect(
      fireReactionTrigger(null, reaction({ entityKind: 'unknownKind', entityId: 'x1' })),
    ).resolves.not.toThrow();
  });

  it('swallows NOT_FOUND when the parent entity does not exist', async () => {
    // No seed for events/does-not-exist.
    await expect(
      fireReactionTrigger(null, reaction({ entityKind: 'event', entityId: 'does-not-exist' })),
    ).resolves.not.toThrow();
  });
});
