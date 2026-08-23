/**
 * Municipality search-key derivation for Node scripts (seed + backfill).
 *
 * This is a deliberate duplicate of `municipalitySearchKey` /
 * `municipalitySearchPrefixes` in
 * packages/shared/src/models/municipality/MunicipalityDataModel.ts: those
 * scripts run as plain .mjs under the Admin SDK, outside the TS build, so they
 * cannot import the model.
 *
 * The two implementations MUST agree — a doc seeded or backfilled with a
 * different prefix set than the app queries for is a village nobody can find,
 * and it fails silently. `packages/shared/test/validation/municipalitySearchDrift.test.ts`
 * runs both over the entire committed dataset and fails the build on any
 * divergence. Change one, change the other.
 */

const SEARCH_STOPWORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'lo', 'y', 'e', 'i',
  'da', 'do', 'das', 'dos', 'a', 'o', 'as', 'os',
  'en', 'sa', 'ses', 'es', 'ets', 'na',
]);

const MAX_PREFIX_LENGTH = 40;

export function searchKey(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function pushPrefixes(source, into) {
  const limit = Math.min(source.length, MAX_PREFIX_LENGTH);
  for (let i = 1; i <= limit; i++) into.add(source.slice(0, i));
}

export function searchPrefixes(name, aliases = [], localities = []) {
  const prefixes = new Set();
  for (const source of [name, ...aliases, ...localities]) {
    const normalized = searchKey(source).trim().replace(/\s+/g, ' ');
    if (normalized.length === 0) continue;
    pushPrefixes(normalized, prefixes);
    const tokens = normalized.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 0);
    for (const token of tokens) {
      if (tokens.length > 1 && SEARCH_STOPWORDS.has(token)) continue;
      pushPrefixes(token, prefixes);
    }
  }
  return [...prefixes].sort();
}
