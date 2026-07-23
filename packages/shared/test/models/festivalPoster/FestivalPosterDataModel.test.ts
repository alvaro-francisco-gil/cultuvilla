import { describe, it, expect } from 'vitest';
import {
  FestivalPosterDataSchema,
  buildFestivalPosterData,
} from '../../../src/models/festivalPoster/FestivalPosterDataModel';

const base = {
  municipalityId: 'm1',
  year: 2025,
  createdAt: new Date('2025-01-02T00:00:00Z'),
};

describe('buildFestivalPosterData', () => {
  it('defaults status to active with no hide metadata, and precision to year, nulling dates', () => {
    const d = buildFestivalPosterData({ ...base, startsAt: new Date(), endsAt: new Date() });
    expect(d.status).toBe('active');
    expect(d.hiddenBy).toBeNull();
    expect(d.hiddenAt).toBeNull();
    expect(d.hiddenReason).toBeNull();
    expect(d.datePrecision).toBe('year');
    expect(d.startsAt).toBeNull();
    expect(d.endsAt).toBeNull();
    expect(d.proposedBy).toBeNull();
    expect(d.contributorUserIds).toEqual([]);
    expect(d.contributorOrgIds).toEqual([]);
    expect(d.title).toBeNull();
    expect(d.images).toEqual([]);
    expect(() => FestivalPosterDataSchema.parse(d)).not.toThrow();
    // fields removed by the review -> visibility migration
    expect('reviewedBy' in d).toBe(false);
    expect('reviewedAt' in d).toBe(false);
  });

  it('defaults images to [] and keeps provided images ordered (cover first)', () => {
    const d = buildFestivalPosterData({ ...base, images: ['a', 'b', 'c'] });
    expect(d.images).toEqual(['a', 'b', 'c']);
    expect(() => FestivalPosterDataSchema.parse(d)).not.toThrow();
  });

  it('rejects more than 5 images at the schema boundary', () => {
    const d = buildFestivalPosterData({ ...base });
    expect(() =>
      FestivalPosterDataSchema.parse({ ...d, images: ['1', '2', '3', '4', '5', '6'] }),
    ).toThrow();
  });

  it('keeps startsAt/endsAt for day precision', () => {
    const s = new Date('2025-08-14T00:00:00Z');
    const e = new Date('2025-08-18T00:00:00Z');
    const d = buildFestivalPosterData({ ...base, datePrecision: 'day', startsAt: s, endsAt: e });
    expect(d.datePrecision).toBe('day');
    expect(d.startsAt).toEqual(s);
    expect(d.endsAt).toEqual(e);
  });

  it('throws when a precise precision has no startsAt', () => {
    expect(() => buildFestivalPosterData({ ...base, datePrecision: 'month' })).toThrow();
  });

  it('rejects a non-integer year at the schema boundary', () => {
    const d = buildFestivalPosterData(base);
    expect(() => FestivalPosterDataSchema.parse({ ...d, year: 2025.5 })).toThrow();
  });
});
