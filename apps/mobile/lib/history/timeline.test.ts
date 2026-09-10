import { buildTimelineRows } from './timeline';

const entry = (id: string, year: number) => ({
  id,
  start: { year, month: null, day: null },
});

describe('buildTimelineRows', () => {
  it('opens each century with a divider, newest first', () => {
    const rows = buildTimelineRows([entry('a', 1975), entry('b', 1936), entry('c', 1899), entry('d', 1212)]);
    expect(rows.map((r) => (r.type === 'century' ? `c${String(r.century)}` : r.entry.id))).toEqual([
      'c20',
      'a',
      'b',
      'c19',
      'c',
      'c13',
      'd',
    ]);
  });

  it('files 1900 in the 19th century, not the 20th', () => {
    const rows = buildTimelineRows([entry('a', 1901), entry('b', 1900)]);
    expect(rows.map((r) => (r.type === 'century' ? `c${String(r.century)}` : r.entry.id))).toEqual([
      'c20',
      'a',
      'c19',
      'b',
    ]);
  });

  it('keys every row uniquely', () => {
    const rows = buildTimelineRows([entry('a', 1975), entry('b', -218)]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  it('is empty for an empty history', () => {
    expect(buildTimelineRows([])).toEqual([]);
  });
});
