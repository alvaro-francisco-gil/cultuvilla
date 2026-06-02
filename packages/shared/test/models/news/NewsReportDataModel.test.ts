import { describe, it, expect } from 'vitest';
import {
  NewsReportDataSchema,
  buildNewsReportData,
} from '../../../src/models/news/NewsReportDataModel';

describe('NewsReportDataSchema', () => {
  it('accepts a valid open report', () => {
    const parsed = NewsReportDataSchema.parse({
      targetType: 'comment',
      targetId: 'c1',
      postId: 'p1',
      municipalityId: 'm1',
      reporterUserId: 'u1',
      reason: 'spam',
      createdAt: new Date(),
      status: 'open',
      resolvedBy: null,
      resolvedAt: null,
    });
    expect(parsed.status).toBe('open');
  });

  it('rejects an unknown status', () => {
    expect(() =>
      NewsReportDataSchema.parse({
        targetType: 'comment',
        targetId: 'c1',
        postId: 'p1',
        municipalityId: 'm1',
        reporterUserId: 'u1',
        reason: 'spam',
        createdAt: new Date(),
        status: 'closed',
        resolvedBy: null,
        resolvedAt: null,
      }),
    ).toThrow();
  });
});

describe('buildNewsReportData', () => {
  it('defaults status open and resolved fields null', () => {
    const r = buildNewsReportData({
      targetType: 'comment',
      targetId: 'c1',
      postId: 'p1',
      municipalityId: 'm1',
      reporterUserId: 'u1',
      reason: 'spam',
      createdAt: new Date(),
    });
    expect(r.status).toBe('open');
    expect(r.resolvedBy).toBeNull();
    expect(r.resolvedAt).toBeNull();
  });
});
