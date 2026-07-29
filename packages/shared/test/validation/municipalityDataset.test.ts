import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { municipalitySearchKey } from '../../src/models/municipality/MunicipalityDataModel';

// scripts/data/municipalities-es.json is the reference dataset that seeds the
// `municipalities` collection — it decides which villages a user can find at all.
// It is generated from Wikidata by scripts/fetch-municipalities.mjs, and a query
// regression there is invisible in review: the file still parses, the app still
// works, and users in whole provinces simply cannot find their pueblo.
//
// That shipped once. The generator matched `wdt:P31 wd:Q2074737` directly, but
// most municipalities are typed with a regional subclass ("municipio de La
// Rioja", "concello", "concejo"), so ~2,000 were silently dropped — La Rioja had
// 7 of its 174 municipalities, A Coruña 1 of 93. It surfaced only when a user
// reported that Alesanco was missing.
//
// These assertions are the guard: they fail the build if the dataset is ever
// regenerated into a partial state.

const repoRoot = resolve(__dirname, '../../../..');
const datasetPath = resolve(repoRoot, 'scripts/data/municipalities-es.json');

interface MunicipalityEntry {
  name: string;
  province: string;
  comunidadAutonoma: string;
  codigoINE: string;
}

function isMunicipalityEntry(value: unknown): value is MunicipalityEntry {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.name === 'string' &&
    typeof record.province === 'string' &&
    typeof record.comunidadAutonoma === 'string' &&
    typeof record.codigoINE === 'string'
  );
}

function loadDataset(): MunicipalityEntry[] {
  const parsed: unknown = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  if (!Array.isArray(parsed)) throw new Error('municipalities-es.json is not an array');
  if (!parsed.every(isMunicipalityEntry)) {
    throw new Error('municipalities-es.json contains an entry with a missing/invalid field');
  }
  return parsed;
}

const dataset = loadDataset();

// Spain has 8,131 municipios (INE, 2024). Wikidata also carries some
// dissolved/merged ones, so a small surplus is expected — a shortfall is not.
const EXPECTED_TOTAL = 8131;
const TOLERANCE = 100;

// Official INE municipality count per province code (first two digits of the
// INE code). Stable — Spain's province codes haven't changed since 1833, and
// municipality counts move by one or two a decade at most.
const OFFICIAL_COUNTS: Record<string, number> = {
  '01': 51, '02': 87, '03': 141, '04': 103, '05': 248, '06': 165, '07': 67,
  '08': 311, '09': 371, '10': 223, '11': 45, '12': 135, '13': 102, '14': 77,
  '15': 93, '16': 238, '17': 221, '18': 174, '19': 288, '20': 88, '21': 80,
  '22': 202, '23': 97, '24': 211, '25': 231, '26': 174, '27': 67, '28': 179,
  '29': 103, '30': 45, '31': 272, '32': 92, '33': 78, '34': 191, '35': 34,
  '36': 61, '37': 362, '38': 54, '39': 102, '40': 208, '41': 106, '42': 183,
  '43': 184, '44': 236, '45': 204, '46': 266, '47': 225, '48': 112, '49': 248,
  '50': 292, '51': 1, '52': 1,
};

function countByProvinceCode(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of dataset) {
    const code = entry.codigoINE.slice(0, 2);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return counts;
}

describe('municipalities-es.json reference dataset', () => {
  it('covers approximately every Spanish municipality', () => {
    expect(dataset.length).toBeGreaterThanOrEqual(EXPECTED_TOTAL - TOLERANCE);
    expect(dataset.length).toBeLessThanOrEqual(EXPECTED_TOTAL + TOLERANCE);
  });

  it('has every entry well-formed', () => {
    const malformed = dataset.filter(
      (e) =>
        !e.name ||
        !e.province ||
        !e.comunidadAutonoma ||
        !/^\d{5}$/.test(e.codigoINE) ||
        /^Q\d+$/.test(e.name),
    );
    expect(malformed).toEqual([]);
  });

  it('has no duplicate INE codes', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const e of dataset) {
      if (seen.has(e.codigoINE)) duplicates.push(e.codigoINE);
      seen.add(e.codigoINE);
    }
    expect(duplicates).toEqual([]);
  });

  // The regression was regionally lopsided — the total was ~76% of expected, but
  // individual provinces were at 1%. A per-province floor is what actually
  // catches a dropped class of municipality.
  it('covers all 52 provinces to within a few of the official INE count', () => {
    const counts = countByProvinceCode();
    const deviations: string[] = [];
    for (const [code, official] of Object.entries(OFFICIAL_COUNTS)) {
      const got = counts.get(code) ?? 0;
      // Allow a small surplus (dissolved municipalities Wikidata still carries)
      // but essentially no shortfall.
      if (got < official - 2 || got > official + 25) {
        deviations.push(`${code}: got ${String(got)}, official ${String(official)}`);
      }
    }
    expect(deviations).toEqual([]);
  });

  it('includes the autonomous cities, which are not typed as municipalities', () => {
    const byCode = new Map(dataset.map((e) => [e.codigoINE, e]));
    // Ceuta is typed ONLY as "ciudad autónoma de España" on Wikidata, so the
    // municipality branch of the query alone misses it.
    expect(byCode.get('51001')?.name).toBe('Ceuta');
    expect(byCode.get('52001')?.name).toBe('Melilla');
  });

  it('includes the municipality whose absence exposed the regression', () => {
    const alesanco = dataset.find((e) => e.codigoINE === '26009');
    expect(alesanco).toMatchObject({ name: 'Alesanco', province: 'La Rioja' });
  });

  // The seed script derives `nameLower` with a copy of municipalitySearchKey;
  // if a name carried a character the search key can't normalize, the village
  // would be unsearchable. Assert every name round-trips to a usable key.
  it('produces a non-empty ASCII-lowercase search key for every name', () => {
    const unsearchable = dataset
      .map((e) => ({ name: e.name, key: municipalitySearchKey(e.name) }))
      .filter(({ key }) => key.length === 0 || /[A-Z̀-ͯ]/.test(key));
    expect(unsearchable).toEqual([]);
  });
});
