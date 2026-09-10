/**
 * The village's poster archive, as read for one year's Wrapped: every cartel up
 * to and including that year, oldest first, so this year's additions land at
 * the end of a long history.
 *
 * The archive is crowdsourced — a missing year means nobody has uploaded that
 * year's cartel yet, not that there were no fiestas. `missingYears` is exposed
 * as a count; nothing here interprets it.
 */

export interface CartelInput {
  id: string;
  year: number;
  title: string | null;
  imageURL: string | null;
}

export interface CartelHistory {
  total: number;
  firstYear: number | null;
  /** Years between the first cartel and this Wrapped's year. */
  spanYears: number;
  yearsWithCartel: number[];
  /** Years inside the span with no cartel uploaded. */
  missingYears: number;
  thisYear: CartelInput[];
  ordered: CartelInput[];
}

export function cartelHistory(posters: CartelInput[], year: number): CartelHistory {
  const ordered = posters
    .filter((p) => p.year <= year)
    .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
  const yearsWithCartel = [...new Set(ordered.map((p) => p.year))];
  const firstYear = yearsWithCartel.length > 0 ? yearsWithCartel[0] : null;
  const spanYears = firstYear === null ? 0 : year - firstYear;
  const lastYear = yearsWithCartel.length > 0 ? yearsWithCartel[yearsWithCartel.length - 1] : null;
  const missingYears = firstYear === null || lastYear === null ? 0 : lastYear - firstYear + 1 - yearsWithCartel.length;
  return {
    total: ordered.length,
    firstYear,
    spanYears,
    yearsWithCartel,
    missingYears,
    thisYear: ordered.filter((p) => p.year === year),
    ordered,
  };
}
