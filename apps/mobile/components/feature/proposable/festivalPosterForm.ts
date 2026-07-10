import type { DatePrecision } from '@cultuvilla/shared/models/festivalPoster';

/** Keep the year field digits-only (max 4) regardless of keyboard/platform. */
export function sanitizeYear(text: string): string {
  return text.replace(/[^0-9]/g, '').slice(0, 4);
}

/**
 * Fold the two optional date pickers into the model's precision + range:
 * no start date → 'year' (dates dropped); a start date → 'day' (with an
 * optional end date). An end date without a start is ignored.
 */
export function datesToPayload(
  startsAt: Date | null,
  endsAt: Date | null,
): { datePrecision: DatePrecision; startsAt: Date | null; endsAt: Date | null } {
  if (!startsAt) return { datePrecision: 'year', startsAt: null, endsAt: null };
  return { datePrecision: 'day', startsAt, endsAt: endsAt ?? null };
}
