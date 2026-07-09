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
  it('defaults status to pending and precision to year, nulling dates', () => {
    const d = buildFestivalPosterData({ ...base, startsAt: new Date(), endsAt: new Date() });
    expect(d.status).toBe('pending');
    expect(d.datePrecision).toBe('year');
    expect(d.startsAt).toBeNull();
    expect(d.endsAt).toBeNull();
    expect(d.proposedBy).toBeNull();
    expect(d.title).toBeNull();
    expect(d.imageURL).toBeNull();
    expect(() => FestivalPosterDataSchema.parse(d)).not.toThrow();
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
