import { describe, it, expect } from 'vitest';
import {
  NewsPostDataSchema,
  buildNewsPostData,
  NEWS_POST_CATEGORIES,
  type NewsPostCategory,
} from '../../../src/models/news/NewsPostDataModel';

describe('NewsPostDataSchema', () => {
  it('accepts a post with organizerUserIds + organizerOrgIds', () => {
    const now = new Date();
    const parsed = NewsPostDataSchema.parse({
      municipalityId: 'm1',
      organizerUserIds: ['u'],
      organizerOrgIds: [],
      createdBy: 'u',
      title: 'Fiesta',
      body: 'Detalles',
      category: 'fiesta',
      images: [{ storagePath: 'p/1', width: 100, height: 50 }],
      status: 'pending',
      rejectionReason: null,
      submittedAt: now,
      publishedAt: null,
      updatedAt: now,
      reactionCounts: { like: 0, heart: 0 },
      commentCount: 0,
    });
    expect(parsed.organizerUserIds).toEqual(['u']);
    expect(parsed.organizerOrgIds).toEqual([]);
    expect(parsed.createdBy).toBe('u');
    expect(parsed.title).toBe('Fiesta');
    expect(parsed.images).toHaveLength(1);
    // authorUserId and authorOrgId must not be in the parsed shape
    expect('authorUserId' in parsed).toBe(false);
    expect('authorOrgId' in parsed).toBe(false);
  });

  it('rejects when a required field is missing', () => {
    const now = new Date();
    expect(() =>
      NewsPostDataSchema.parse({
        // municipalityId missing
        organizerUserIds: ['u1'],
        organizerOrgIds: [],
        createdBy: 'u1',
        title: 'Fiesta',
        body: 'Detalles',
        category: 'fiesta',
        images: [],
        status: 'pending',
        rejectionReason: null,
        submittedAt: now,
        publishedAt: null,
        updatedAt: now,
        reactionCounts: { like: 0, heart: 0 },
        commentCount: 0,
      }),
    ).toThrow();
  });

  it('rejects an out-of-enum category', () => {
    const now = new Date();
    expect(() =>
      NewsPostDataSchema.parse({
        municipalityId: 'm1',
        organizerUserIds: ['u1'],
        organizerOrgIds: [],
        createdBy: 'u1',
        title: 'Fiesta',
        body: 'Detalles',
        category: 'not-a-category',
        images: [],
        status: 'pending',
        rejectionReason: null,
        submittedAt: now,
        publishedAt: null,
        updatedAt: now,
        reactionCounts: { like: 0, heart: 0 },
        commentCount: 0,
      }),
    ).toThrow();
  });
});

describe('buildNewsPostData', () => {
  it('produces a pending post with zeroed counters by default', () => {
    const now = new Date();
    const p = buildNewsPostData({
      municipalityId: 'm1',
      organizerUserIds: ['u1'],
      organizerOrgIds: [],
      createdBy: 'u1',
      title: 'Fiesta',
      body: 'Detalles',
      category: 'fiesta',
      submittedAt: now,
      updatedAt: now,
    });
    expect(p.status).toBe('pending');
    expect(p.publishedAt).toBeNull();
    expect(p.rejectionReason).toBeNull();
    expect(p.images).toEqual([]);
    expect(p.reactionCounts).toEqual({ like: 0, heart: 0 });
    expect(p.commentCount).toBe(0);
    expect(p.organizerUserIds).toEqual(['u1']);
    expect(p.organizerOrgIds).toEqual([]);
  });

  it('exposes the canonical category list', () => {
    const expected: NewsPostCategory[] = ['fiesta', 'tradicion', 'gastronomia', 'historia', 'otro'];
    expect(NEWS_POST_CATEGORIES).toEqual(expected);
  });
});
