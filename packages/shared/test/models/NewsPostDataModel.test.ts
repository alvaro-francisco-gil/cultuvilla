import { describe, it, expect } from 'vitest';
import {
  buildNewsPostData,
  type NewsPostCategory,
  NEWS_POST_CATEGORIES,
} from '../../src/models/news/NewsPostDataModel';

describe('buildNewsPostData', () => {
  it('produces a pending post with zeroed counters by default', () => {
    const now = new Date();
    const p = buildNewsPostData({
      municipalityId: 'm1',
      authorUserId: 'u1',
      title: 'Fiesta',
      body: 'Detalles',
      category: 'fiesta',
      submittedAt: now,
      createdBy: 'u1',
      updatedAt: now,
    });
    expect(p.status).toBe('pending');
    expect(p.publishedAt).toBeNull();
    expect(p.authorOrgId).toBeNull();
    expect(p.rejectionReason).toBeNull();
    expect(p.images).toEqual([]);
    expect(p.reactionCounts).toEqual({ like: 0, heart: 0 });
    expect(p.commentCount).toBe(0);
  });

  it('exposes the canonical category list', () => {
    const expected: NewsPostCategory[] = ['fiesta', 'tradicion', 'gastronomia', 'historia', 'otro'];
    expect(NEWS_POST_CATEGORIES).toEqual(expected);
  });
});
