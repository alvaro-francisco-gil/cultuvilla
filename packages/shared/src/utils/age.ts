/**
 * Age helpers for the self-registration age gate (Terms of Use: 14+ to register
 * a own account; family "personas" have no age floor). Pure and locale-agnostic
 * so they can be unit-tested and reused by the onboarding form.
 */

/**
 * The latest birth date that still makes someone at least `years` old on `asOf`.
 * A birthday strictly after this date means the person is younger than `years`.
 * Month/day are preserved so the boundary is exact (not year-only).
 */
export function maxBirthdayForAge(years: number, asOf: Date): Date {
  return new Date(asOf.getFullYear() - years, asOf.getMonth(), asOf.getDate());
}

/** True when someone born on `birthday` is at least `years` old on `asOf`. */
export function isAtLeastYearsOld(birthday: Date, years: number, asOf: Date): boolean {
  return birthday.getTime() <= maxBirthdayForAge(years, asOf).getTime();
}
