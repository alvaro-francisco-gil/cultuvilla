import { describe, it, expect } from 'vitest';
import { cartelHistory, type CartelInput } from '../../src/wrapped/cartelHistory';

const c = (id: string, year: number): CartelInput => ({ id, year, title: null, imageURL: `https://x/${id}.jpg` });

describe('cartelHistory', () => {
  // Matabuena: 1960 → 2026, 73 carteles, 3 added this year.
  it('orders the archive oldest first, so this year lands at the end', () => {
    const h = cartelHistory([c('b', 2026), c('a', 1960), c('m', 1977)], 2026);
    expect(h.ordered.map((p) => p.year)).toEqual([1960, 1977, 2026]);
  });

  it("separates this year's carteles from the history", () => {
    const h = cartelHistory([c('a', 1960), c('x', 2026), c('y', 2026)], 2026);
    expect(h.thisYear.map((p) => p.id)).toEqual(['x', 'y']);
    expect(h.total).toBe(3);
  });

  it('measures the span of the archive in years', () => {
    const h = cartelHistory([c('a', 1960), c('z', 2026)], 2026);
    expect(h.firstYear).toBe(1960);
    expect(h.spanYears).toBe(66);
  });

  // The archive is crowdsourced: a gap means nobody uploaded that year yet, not
  // that there were no fiestas. The count is exposed; the reading is not.
  it('counts the years missing inside the span', () => {
    const h = cartelHistory([c('a', 1960), c('b', 1962), c('z', 1965)], 1965);
    expect(h.yearsWithCartel).toEqual([1960, 1962, 1965]);
    expect(h.missingYears).toBe(3); // 1961, 1963, 1964
  });

  it('counts a year with several carteles once', () => {
    const h = cartelHistory([c('a', 2019), c('b', 2019), c('c', 2019)], 2019);
    expect(h.yearsWithCartel).toEqual([2019]);
    expect(h.total).toBe(3);
  });

  it('leaves out carteles dated after the Wrapped year', () => {
    const h = cartelHistory([c('a', 2025), c('future', 2027)], 2026);
    expect(h.ordered.map((p) => p.id)).toEqual(['a']);
  });

  it('keeps a stable order within a year across recomputes', () => {
    const a = cartelHistory([c('b', 2019), c('a', 2019)], 2019);
    const b = cartelHistory([c('a', 2019), c('b', 2019)], 2019);
    expect(a.ordered.map((p) => p.id)).toEqual(b.ordered.map((p) => p.id));
  });

  it('reports an empty archive without inventing a span', () => {
    const h = cartelHistory([], 2026);
    expect(h).toMatchObject({ total: 0, firstYear: null, spanYears: 0, missingYears: 0, thisYear: [] });
  });

  it('has a zero span when the archive is a single year', () => {
    expect(cartelHistory([c('a', 2026)], 2026).spanYears).toBe(0);
  });
});
