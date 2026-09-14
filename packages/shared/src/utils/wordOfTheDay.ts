const MORE_COUNT = 3;

/** FNV-1a: tiny, deterministic, and spreads adjacent day keys far apart. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The village home's "palabra del día", plus a few others to follow on to.
 *
 * Derived from the date rather than stored: every viewer of a pueblo sees the
 * same word all day with no write, no scheduler and nothing to backfill. The
 * day is the device's local calendar day. The village id salts the hash so
 * neighbouring pueblos don't feature their words in lockstep.
 */
export function pickWordOfTheDay<T>(
  terms: readonly T[],
  municipalityId: string,
  now: Date,
): { today: T; more: T[] } | null {
  if (terms.length === 0) return null;
  const dayKey = `${String(now.getFullYear())}-${String(now.getMonth() + 1)}-${String(now.getDate())}`;
  const index = hash(`${municipalityId}:${dayKey}`) % terms.length;
  const more = Array.from(
    { length: Math.min(MORE_COUNT, terms.length - 1) },
    (_, i) => terms[(index + 1 + i) % terms.length],
  );
  return { today: terms[index], more };
}
