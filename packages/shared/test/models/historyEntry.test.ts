import { describe, it, expect } from 'vitest';
import {
  HistoricalDateSchema,
  HistoryEntryDataSchema,
  HISTORY_ENTRY_MAX_IMAGES,
  buildHistoryEntryData,
  historicalDateSortKey,
  type HistoryEntryDataInput,
} from '../../src/models/history/HistoryEntryDataModel';

const NOW = new Date('2026-09-11T10:00:00Z');

function input(over: Partial<HistoryEntryDataInput> = {}): HistoryEntryDataInput {
  return {
    municipalityId: '40001',
    villageSlug: 'villarriba',
    createdBy: 'u1',
    title: 'Carta puebla',
    body: { text: 'El rey concede fueros.', mentions: [], links: [], marks: [] },
    start: { year: 1212, month: null, day: null },
    createdAt: NOW,
    ...over,
  };
}

describe('HistoricalDateSchema', () => {
  it('accepts a bare year, a month and a full date', () => {
    expect(HistoricalDateSchema.parse({ year: 1212, month: null, day: null })).toBeTruthy();
    expect(HistoricalDateSchema.parse({ year: 1936, month: 3, day: null })).toBeTruthy();
    expect(HistoricalDateSchema.parse({ year: 1902, month: 8, day: 14 })).toBeTruthy();
  });

  it('accepts a year before Christ, which a Firestore Timestamp could not hold', () => {
    expect(HistoricalDateSchema.parse({ year: -218, month: null, day: null }).year).toBe(-218);
  });

  it('rejects year 0 — the calendar goes from 1 a. C. straight to 1 d. C.', () => {
    expect(() => HistoricalDateSchema.parse({ year: 0, month: null, day: null })).toThrow();
  });

  it('rejects a day without a month', () => {
    expect(() => HistoricalDateSchema.parse({ year: 1900, month: null, day: 3 })).toThrow();
  });

  it('rejects a day that does not exist in that month', () => {
    expect(() => HistoricalDateSchema.parse({ year: 1900, month: 2, day: 30 })).toThrow();
    expect(() => HistoricalDateSchema.parse({ year: 1900, month: 2, day: 29 })).toThrow();
    expect(HistoricalDateSchema.parse({ year: 2000, month: 2, day: 29 })).toBeTruthy();
  });

  it('rejects out-of-range months', () => {
    expect(() => HistoricalDateSchema.parse({ year: 1900, month: 13, day: null })).toThrow();
  });
});

describe('historicalDateSortKey', () => {
  it('orders by year, then month, then day', () => {
    const keys = [
      { year: 1936, month: 7, day: 18 },
      { year: 1936, month: null, day: null },
      { year: 1212, month: null, day: null },
      { year: 1936, month: 7, day: null },
      { year: 2001, month: 1, day: 1 },
    ].map(historicalDateSortKey);
    expect([...keys].sort((a, b) => a - b)).toEqual([
      historicalDateSortKey({ year: 1212, month: null, day: null }),
      historicalDateSortKey({ year: 1936, month: null, day: null }),
      historicalDateSortKey({ year: 1936, month: 7, day: null }),
      historicalDateSortKey({ year: 1936, month: 7, day: 18 }),
      historicalDateSortKey({ year: 2001, month: 1, day: 1 }),
    ]);
  });

  it('keeps years before Christ in chronological order', () => {
    const early = historicalDateSortKey({ year: -500, month: null, day: null });
    const later = historicalDateSortKey({ year: -218, month: 6, day: 1 });
    const ad = historicalDateSortKey({ year: 1, month: null, day: null });
    expect(early).toBeLessThan(later);
    expect(later).toBeLessThan(ad);
  });

  it('is the formula firestore.rules re-derives', () => {
    expect(historicalDateSortKey({ year: 1936, month: 7, day: 18 })).toBe(19360718);
    expect(historicalDateSortKey({ year: -218, month: null, day: null })).toBe(-2180000);
  });
});

describe('buildHistoryEntryData', () => {
  it('fills defaults and derives sortKey from the start date', () => {
    const data = buildHistoryEntryData(input());
    expect(data).toMatchObject({
      municipalityId: '40001',
      villageSlug: 'villarriba',
      title: 'Carta puebla',
      images: [],
      end: null,
      approximate: false,
      sources: null,
      sortKey: 12120000,
      commentCount: 0,
      readCount: 0,
      status: 'active',
      updatedAt: NOW,
    });
    expect(HistoryEntryDataSchema.parse(data)).toEqual(data);
  });

  it('trims the title and blanks empty sources', () => {
    const data = buildHistoryEntryData(input({ title: '  Guerra  ', sources: '   ' }));
    expect(data.title).toBe('Guerra');
    expect(data.sources).toBeNull();
  });
});

describe('HistoryEntryDataSchema', () => {
  it('accepts a range', () => {
    const data = buildHistoryEntryData(
      input({ start: { year: 1936, month: null, day: null }, end: { year: 1939, month: null, day: null } }),
    );
    expect(HistoryEntryDataSchema.parse(data).end?.year).toBe(1939);
  });

  it('rejects a range that ends before, or on, its start', () => {
    const backwards = buildHistoryEntryData(
      input({ start: { year: 1939, month: null, day: null }, end: { year: 1936, month: null, day: null } }),
    );
    expect(() => HistoryEntryDataSchema.parse(backwards)).toThrow();
    const same = buildHistoryEntryData(
      input({ start: { year: 1939, month: null, day: null }, end: { year: 1939, month: null, day: null } }),
    );
    expect(() => HistoryEntryDataSchema.parse(same)).toThrow();
  });

  it(`caps the gallery at ${String(HISTORY_ENTRY_MAX_IMAGES)} images`, () => {
    const image = { url: 'https://x/a.jpg', caption: null };
    const ok = buildHistoryEntryData(input({ images: [image, image, image] }));
    expect(HistoryEntryDataSchema.parse(ok).images).toHaveLength(3);
    const tooMany = buildHistoryEntryData(input({ images: [image, image, image, image] }));
    expect(() => HistoryEntryDataSchema.parse(tooMany)).toThrow();
  });

  it('rejects an empty title', () => {
    expect(() => HistoryEntryDataSchema.parse(buildHistoryEntryData(input({ title: '  ' })))).toThrow();
  });

  it('rejects a sortKey that disagrees with the start date', () => {
    const data = { ...buildHistoryEntryData(input()), sortKey: 1 };
    expect(() => HistoryEntryDataSchema.parse(data)).toThrow();
  });
});
