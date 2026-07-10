import { describe, it, expect } from 'vitest';
import { buildCommentData } from '../../src/models/interaction/CommentDataModel';
import { buildReactionData, reactionDocId, ReactionCountsSchema } from '../../src/models/interaction/ReactionDataModel';

describe('CommentData', () => {
  it('builds a comment carrying its entity coordinates', () => {
    const now = new Date();
    const c = buildCommentData({ entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'Hola', createdAt: now });
    expect(c).toEqual({ entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'Hola', createdAt: now });
  });
});

describe('ReactionData', () => {
  it('doc id is entityKind_entityId_userId', () => {
    expect(reactionDocId('place', 'p1', 'u1')).toBe('place_p1_u1');
  });
  it('builds a reaction', () => {
    const now = new Date();
    const r = buildReactionData({ entityKind: 'news', entityId: 'n1', municipalityId: 'm1', userId: 'u1', kind: 'heart', createdAt: now });
    expect(r.kind).toBe('heart');
  });
  it('ReactionCountsSchema validates a like/heart pair', () => {
    expect(ReactionCountsSchema.parse({ like: 2, heart: 1 })).toEqual({ like: 2, heart: 1 });
    expect(() => ReactionCountsSchema.parse({ like: 2 })).toThrow();
  });
});
