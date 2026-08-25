import { birthYearRangeLabel } from '../birthYearLabel';

const t = (key: string, values?: Record<string, string>) =>
  values ? `${key}:${Object.values(values).join(',')}` : key;

describe('birthYearRangeLabel', () => {
  it('returns null when the event advertises no window', () => {
    expect(birthYearRangeLabel({ minBirthYear: null, maxBirthYear: null }, t)).toBeNull();
  });

  it('labels a closed range', () => {
    expect(birthYearRangeLabel({ minBirthYear: 2014, maxBirthYear: 2020 }, t)).toBe(
      'event.birthYearLabel.between:2014,2020',
    );
  });

  it('collapses a single-year range to the exact wording', () => {
    expect(birthYearRangeLabel({ minBirthYear: 1985, maxBirthYear: 1985 }, t)).toBe(
      'event.birthYearLabel.exact:1985',
    );
  });

  it('labels each open-ended shape', () => {
    expect(birthYearRangeLabel({ minBirthYear: 1985, maxBirthYear: null }, t)).toBe(
      'event.birthYearLabel.from:1985',
    );
    expect(birthYearRangeLabel({ minBirthYear: null, maxBirthYear: 1960 }, t)).toBe(
      'event.birthYearLabel.to:1960',
    );
  });
});
