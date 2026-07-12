import { describe, it, expect } from 'vitest';
import { formatFestivalPosterDates } from '../../src/utils/festivalPosterDates';

describe('formatFestivalPosterDates', () => {
  it('returns null for year precision', () => {
    expect(formatFestivalPosterDates({ year: 2025, datePrecision: 'year', startsAt: null, endsAt: null })).toBeNull();
  });
  it('formats a month as "Mes Año"', () => {
    expect(
      formatFestivalPosterDates({ year: 2025, datePrecision: 'month', startsAt: new Date(2025, 7, 1), endsAt: null }),
    ).toBe('Agosto 2025');
  });
  it('formats a day range', () => {
    expect(
      formatFestivalPosterDates({
        year: 2025, datePrecision: 'day',
        startsAt: new Date(2025, 7, 14), endsAt: new Date(2025, 7, 18),
      }),
    ).toBe('14 de Agosto – 18 de Agosto 2025');
  });
  it('formats a single day (no distinct end)', () => {
    expect(
      formatFestivalPosterDates({ year: 2025, datePrecision: 'day', startsAt: new Date(2025, 7, 14), endsAt: null }),
    ).toBe('14 de Agosto 2025');
  });
});
