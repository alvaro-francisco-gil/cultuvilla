import { filterOptions, normalizeSearchText, orderOptions } from '../pickerOptions';

const OPTIONS = [
  { id: 'c', label: 'Sergio Gil Arjona' },
  { id: 'a', label: 'Esther Martín Priego' },
  { id: 'b', label: 'Ana Isabel Vicente Martín' },
  { id: 'd', label: 'Ángela Ñoño Ruiz' },
];

describe('normalizeSearchText', () => {
  it('strips accents, lowercases and collapses whitespace', () => {
    expect(normalizeSearchText('  Esther   MARTÍN  ')).toBe('esther martin');
  });

  it('leaves an already-normal string alone', () => {
    expect(normalizeSearchText('ana')).toBe('ana');
  });
});

describe('filterOptions', () => {
  it('returns everything for a blank or whitespace-only term', () => {
    expect(filterOptions(OPTIONS, '')).toHaveLength(4);
    expect(filterOptions(OPTIONS, '   ')).toHaveLength(4);
  });

  it('matches a substring anywhere in the label, not just the prefix', () => {
    expect(filterOptions(OPTIONS, 'gil').map((o) => o.id)).toEqual(['c']);
    expect(filterOptions(OPTIONS, 'vicente').map((o) => o.id)).toEqual(['b']);
  });

  it('matches across accents in both directions', () => {
    expect(filterOptions(OPTIONS, 'martin').map((o) => o.id)).toEqual(['a', 'b']);
    expect(filterOptions(OPTIONS, 'MARTÍN').map((o) => o.id)).toEqual(['a', 'b']);
    expect(filterOptions(OPTIONS, 'angela').map((o) => o.id)).toEqual(['d']);
  });

  it('returns nothing when no label matches', () => {
    expect(filterOptions(OPTIONS, 'zzz')).toEqual([]);
  });
});

describe('orderOptions', () => {
  it('sorts alphabetically by label, accent-insensitively', () => {
    expect(orderOptions(OPTIONS, new Set()).map((o) => o.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('prefers an explicit sortKey over the label', () => {
    const withKeys = [
      { id: 'x', label: 'Zulema', sortKey: 'aaa' },
      { id: 'y', label: 'Ana', sortKey: 'zzz' },
    ];
    expect(orderOptions(withKeys, new Set()).map((o) => o.id)).toEqual(['x', 'y']);
  });

  it('pins the already-selected rows to the top, each group still alphabetical', () => {
    expect(orderOptions(OPTIONS, new Set(['c', 'a'])).map((o) => o.id)).toEqual([
      'a',
      'c',
      'b',
      'd',
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [...OPTIONS];
    orderOptions(input, new Set());
    expect(input.map((o) => o.id)).toEqual(['c', 'a', 'b', 'd']);
  });
});
