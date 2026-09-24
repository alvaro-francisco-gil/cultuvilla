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
 * The village home's "palabra del día".
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
): T | null {
  const dayKey = `${String(now.getFullYear())}-${String(now.getMonth() + 1)}-${String(now.getDate())}`;
  const index = hash(`${municipalityId}:${dayKey}`) % Math.max(terms.length, 1);
  // `find` rather than indexing: the mobile app compiles this file with
  // noUncheckedIndexedAccess and the shared package does not, so an index needs
  // an assertion one side rejects as unnecessary and the other requires.
  return terms.find((_, i) => i === index) ?? null;
}
