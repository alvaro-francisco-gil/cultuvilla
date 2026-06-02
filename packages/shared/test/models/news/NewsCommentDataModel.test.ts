import { describe, it, expect } from 'vitest';
import {
  NewsCommentDataSchema,
  buildNewsCommentData,
} from '../../../src/models/news/NewsCommentDataModel';

describe('NewsCommentDataSchema', () => {
  it('accepts a fully populated comment', () => {
    const parsed = NewsCommentDataSchema.parse({
      postId: 'p1',
      municipalityId: 'm1',
      authorUserId: 'u1',
      body: 'hola',
      createdAt: new Date(),
      hidden: false,
    });
    expect(parsed.body).toBe('hola');
  });

  it('rejects when body is missing', () => {
    expect(() =>
      NewsCommentDataSchema.parse({
        postId: 'p1',
        municipalityId: 'm1',
        authorUserId: 'u1',
        // body missing
        createdAt: new Date(),
        hidden: false,
      }),
    ).toThrow();
  });
});

describe('buildNewsCommentData', () => {
  it('defaults hidden=false', () => {
    const c = buildNewsCommentData({
      postId: 'p1',
      municipalityId: 'm1',
      authorUserId: 'u1',
      body: 'hola',
      createdAt: new Date(),
    });
    expect(c.hidden).toBe(false);
  });
});
