import { describe, it, expect } from 'vitest';
import {
  FiestaAnchorSchema,
  FiestaBlockSchema,
  clampAnchor,
  fiestaBlockId,
  buildFiestaBlock,
  isFiestaBlockOver,
  nextFiestaWindow,
  resolveFiestaWindow,
} from '../../../src/models/municipality/FiestaBlockModel';

// Matabuena's two real 2026 blocks — the case the model exists for.
const santiago = buildFiestaBlock({
  id: 'santiago',
  name: 'Santiago',
  anchor: { month: 7, day: 24, days: 3 },
  years: { 2026: { start: new Date('2026-07-24T00:00:00+02:00'), end: new Date('2026-07-26T23:59:59.999+02:00') } },
});
const agosto = buildFiestaBlock({
  id: 'agosto',
  name: 'Fiestas de agosto',
  anchor: { month: 8, day: 23, days: 6 },
  years: { 2026: { start: new Date('2026-08-23T00:00:00+02:00'), end: new Date('2026-08-28T23:59:59.999+02:00') } },
});

describe('resolveFiestaWindow — exact overrides', () => {
  it('prefers the stored per-year window over the anchor', () => {
    const w = resolveFiestaWindow(agosto, 2026);
    expect(w?.source).toBe('exact');
    expect(w?.start.toISOString()).toBe('2026-08-22T22:00:00.000Z'); // Madrid midnight
  });

  it('falls back to the anchor for a year with no override', () => {
    const w = resolveFiestaWindow(agosto, 2027);
    expect(w?.source).toBe('anchor');
  });
});

describe('resolveFiestaWindow — exactOnly', () => {
  // The load-bearing rule: a published Wrapped must never be built from an
  // approximate window, or it silently clips or over-includes events.
  it('returns the window when the year is declared', () => {
    expect(resolveFiestaWindow(agosto, 2026, { exactOnly: true })?.source).toBe('exact');
  });

  it('returns null rather than materializing the anchor', () => {
    expect(resolveFiestaWindow(agosto, 2027, { exactOnly: true })).toBeNull();
  });
});

/** Narrows away the null branch so the tests avoid non-null assertions. */
function must<T>(value: T | null): T {
  if (value === null) throw new Error('expected a resolved fiesta window');
  return value;
}

describe('anchor materialization', () => {
  it('spans `days` calendar days, inclusive', () => {
    const w = must(resolveFiestaWindow(agosto, 2027));
    const days = Math.round((w.end.getTime() - w.start.getTime()) / 86_400_000);
    expect(days).toBe(6);
  });

  it('starts at Madrid midnight, not UTC midnight', () => {
    // A UTC boundary would put the start two hours into the previous day
    // locally — the fiestas would "begin" at 02:00 on the 23rd.
    const w = must(resolveFiestaWindow(agosto, 2027));
    expect(w.start.toISOString()).toBe('2027-08-22T22:00:00.000Z');
  });

  it('ends at the last instant of the final day', () => {
    const w = must(resolveFiestaWindow(agosto, 2027));
    expect(w.end.toISOString()).toBe('2027-08-28T21:59:59.999Z');
  });

  // Date.UTC(2027, 1, 29) rolls to 1 March. A 29-February anchor must stay in
  // February — a fiesta declared for the end of February is not a March fiesta.
  it('clamps a 29 February anchor to 28 February in a non-leap year', () => {
    const b = buildFiestaBlock({ id: 'f', name: 'F', anchor: { month: 2, day: 29, days: 1 } });
    const w = must(resolveFiestaWindow(b, 2027));
    expect(w.start.toISOString()).toBe('2027-02-27T23:00:00.000Z'); // 28 Feb, Madrid
    expect(w.end.toISOString()).toBe('2027-02-28T22:59:59.999Z');
  });

  it('keeps 29 February in a leap year', () => {
    const b = buildFiestaBlock({ id: 'f', name: 'F', anchor: { month: 2, day: 29, days: 1 } });
    expect(must(resolveFiestaWindow(b, 2028)).start.toISOString()).toBe('2028-02-28T23:00:00.000Z');
  });

  it('never lets a block start in a later month than its anchor declares', () => {
    for (let month = 1; month <= 12; month++) {
      for (const day of [28, 29, 30, 31]) {
        const b = buildFiestaBlock({ id: 'f', name: 'F', anchor: clampAnchor({ month, day, days: 1 }) });
        const w = must(resolveFiestaWindow(b, 2027));
        // +2h puts a Madrid midnight back into the correct local month.
        expect(new Date(w.start.getTime() + 7_200_000).getUTCMonth() + 1).toBe(month);
      }
    }
  });

  it('handles a winter block, where Madrid is UTC+1 not UTC+2', () => {
    const reyes = buildFiestaBlock({ id: 'reyes', name: 'Reyes', anchor: { month: 1, day: 5, days: 2 } });
    const w = must(resolveFiestaWindow(reyes, 2027));
    expect(w.start.toISOString()).toBe('2027-01-04T23:00:00.000Z');
  });

  it('rolls a block across a month boundary', () => {
    const b = buildFiestaBlock({ id: 'x', name: 'X', anchor: { month: 8, day: 30, days: 4 } });
    const w = must(resolveFiestaWindow(b, 2027));
    expect(w.end.toISOString()).toBe('2027-09-02T21:59:59.999Z');
  });
});

describe('isFiestaBlockOver', () => {
  const w = must(resolveFiestaWindow(agosto, 2026));

  it('is false during the last night of the fiestas', () => {
    expect(isFiestaBlockOver(w, new Date('2026-08-28T23:30:00+02:00'))).toBe(false);
  });

  it('is true once the final day has passed', () => {
    expect(isFiestaBlockOver(w, new Date('2026-08-29T00:30:00+02:00'))).toBe(true);
  });

  // 21:30Z is 23:30 in Madrid — still the final day. A comparison that read the
  // UTC calendar day would already have rolled over and closed the block.
  it('does not end the block early on a UTC day boundary', () => {
    expect(isFiestaBlockOver(w, new Date('2026-08-28T21:30:00Z'))).toBe(false);
    expect(isFiestaBlockOver(w, new Date('2026-08-28T22:30:00Z'))).toBe(true);
  });
});

describe('nextFiestaWindow', () => {
  it('picks the earliest block still ahead of now', () => {
    const next = nextFiestaWindow([agosto, santiago], new Date('2026-06-01T12:00:00Z'));
    expect(next?.block.id).toBe('santiago');
  });

  it('skips a block already over and moves to the next in the same year', () => {
    const next = nextFiestaWindow([santiago, agosto], new Date('2026-08-01T12:00:00Z'));
    expect(next?.block.id).toBe('agosto');
  });

  it('rolls to next year once every block is done', () => {
    const next = nextFiestaWindow([santiago, agosto], new Date('2026-12-01T12:00:00Z'));
    expect(next?.window.start.getUTCFullYear()).toBe(2027);
  });

  it('is null when the village has declared no blocks', () => {
    expect(nextFiestaWindow([], new Date())).toBeNull();
  });
});

describe('FiestaBlockSchema', () => {
  const valid = {
    id: 'agosto',
    name: 'Fiestas de agosto',
    anchor: { month: 8, day: 23, days: 6 },
    years: {},
  };

  it('accepts a block with no declared years', () => {
    expect(FiestaBlockSchema.parse(valid).years).toEqual({});
  });

  it('rejects an out-of-range month', () => {
    expect(() => FiestaBlockSchema.parse({ ...valid, anchor: { month: 13, day: 1, days: 1 } })).toThrow();
  });

  it('rejects a day that does not exist in that month', () => {
    expect(() => FiestaBlockSchema.parse({ ...valid, anchor: { month: 2, day: 30, days: 1 } })).toThrow();
  });

  it('allows 29 February, which is a real date in a leap year', () => {
    expect(() => FiestaBlockSchema.parse({ ...valid, anchor: { month: 2, day: 29, days: 1 } })).not.toThrow();
  });

  it('rejects a zero-day block', () => {
    expect(() => FiestaBlockSchema.parse({ ...valid, anchor: { month: 8, day: 23, days: 0 } })).toThrow();
  });

  it('rejects a window whose end precedes its start', () => {
    expect(() =>
      FiestaBlockSchema.parse({
        ...valid,
        years: { 2026: { start: new Date('2026-08-28'), end: new Date('2026-08-23') } },
      }),
    ).toThrow();
  });
});

describe('buildFiestaBlock', () => {
  it('defaults years to empty, matching the backfill default', () => {
    expect(buildFiestaBlock({ id: 'a', name: 'A', anchor: { month: 1, day: 1, days: 1 } }).years).toEqual({});
  });

  it('keys years by string, as Firestore stores map keys', () => {
    const b = buildFiestaBlock({
      id: 'a',
      name: 'A',
      anchor: { month: 1, day: 1, days: 1 },
      years: { 2026: { start: new Date('2026-01-01'), end: new Date('2026-01-02') } },
    });
    expect(Object.keys(b.years)).toEqual(['2026']);
  });
});

describe('fiestaBlockId', () => {
  it('slugifies the name, accent-stripped', () => {
    expect(fiestaBlockId('Fiestas de Agosto', [])).toBe('fiestas-de-agosto');
    expect(fiestaBlockId('San Sebastián', [])).toBe('san-sebastian');
  });

  it('suffixes to stay unique, since the id keys the Wrapped doc', () => {
    expect(fiestaBlockId('Santiago', ['santiago'])).toBe('santiago-2');
    expect(fiestaBlockId('Santiago', ['santiago', 'santiago-2'])).toBe('santiago-3');
  });

  it('falls back rather than producing an empty id', () => {
    expect(fiestaBlockId('   ', [])).toBe('fiesta');
    expect(fiestaBlockId('!!!', ['fiesta'])).toBe('fiesta-2');
  });
});

describe('clampAnchor', () => {
  it('leaves a valid anchor alone', () => {
    expect(clampAnchor({ month: 8, day: 23, days: 6 })).toEqual({ month: 8, day: 23, days: 6 });
  });

  it('pulls a day back into the month rather than rolling over silently', () => {
    expect(clampAnchor({ month: 2, day: 31, days: 1 }).day).toBe(29);
    expect(clampAnchor({ month: 4, day: 31, days: 1 }).day).toBe(30);
  });

  it('clamps out-of-range months and non-positive lengths', () => {
    expect(clampAnchor({ month: 0, day: 5, days: 3 }).month).toBe(1);
    expect(clampAnchor({ month: 99, day: 5, days: 3 }).month).toBe(12);
    expect(clampAnchor({ month: 8, day: 0, days: 0 })).toMatchObject({ day: 1, days: 1 });
  });

  it('produces an anchor the schema accepts, for any garbage in', () => {
    for (const bad of [
      { month: -4, day: 99, days: -2 },
      { month: 2, day: 30, days: 400 },
      { month: 13, day: 0, days: 0 },
    ]) {
      expect(() => FiestaAnchorSchema.parse(clampAnchor(bad))).not.toThrow();
    }
  });
});
