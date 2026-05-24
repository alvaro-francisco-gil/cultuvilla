import { describe, it, expect } from 'vitest';
import { buildNewsCommentData } from '../../src/models/news/NewsCommentDataModel';
import { buildNewsReactionData, reactionDocId } from '../../src/models/news/NewsReactionDataModel';
import { buildNewsReportData } from '../../src/models/news/NewsReportDataModel';

describe('NewsCommentData', () => {
  it('defaults hidden=false', () => {
    const c = buildNewsCommentData({
      postId: 'p1', municipalityId: 'm1', authorUserId: 'u1', body: 'hola', createdAt: new Date(),
    });
    expect(c.hidden).toBe(false);
  });
});

describe('NewsReactionData', () => {
  it('uses deterministic doc id postId_userId', () => {
    expect(reactionDocId('p1', 'u1')).toBe('p1_u1');
  });
  it('builds with required fields', () => {
    const r = buildNewsReactionData({
      postId: 'p1', municipalityId: 'm1', userId: 'u1', kind: 'like', createdAt: new Date(),
    });
    expect(r).toMatchObject({ postId: 'p1', userId: 'u1', kind: 'like' });
  });
});

describe('NewsReportData', () => {
  it('defaults status open and resolved fields null', () => {
    const r = buildNewsReportData({
      targetType: 'comment',
      targetId: 'c1', postId: 'p1', municipalityId: 'm1',
      reporterUserId: 'u1', reason: 'spam', createdAt: new Date(),
    });
    expect(r.status).toBe('open');
    expect(r.resolvedBy).toBeNull();
    expect(r.resolvedAt).toBeNull();
  });
});
