import { describe, it, expect } from 'vitest';
import {
  NewsReactionDataSchema,
  buildNewsReactionData,
  reactionDocId,
} from '../../../src/models/news/NewsReactionDataModel';

describe('NewsReactionDataSchema', () => {
  it('accepts a valid reaction', () => {
    const parsed = NewsReactionDataSchema.parse({
      postId: 'p1',
      municipalityId: 'm1',
      userId: 'u1',
      kind: 'like',
      createdAt: new Date(),
    });
    expect(parsed.kind).toBe('like');
  });

  it('rejects an unknown reaction kind', () => {
    expect(() =>
      NewsReactionDataSchema.parse({
        postId: 'p1',
        municipalityId: 'm1',
        userId: 'u1',
        kind: 'sparkle',
        createdAt: new Date(),
      }),
    ).toThrow();
  });
});

describe('reactionDocId', () => {
  it('uses deterministic doc id postId_userId', () => {
    expect(reactionDocId('p1', 'u1')).toBe('p1_u1');
  });
});

describe('buildNewsReactionData', () => {
  it('builds with required fields', () => {
    const r = buildNewsReactionData({
      postId: 'p1',
      municipalityId: 'm1',
      userId: 'u1',
      kind: 'heart',
      createdAt: new Date(),
    });
    expect(r).toMatchObject({ postId: 'p1', userId: 'u1', kind: 'heart' });
  });
});
