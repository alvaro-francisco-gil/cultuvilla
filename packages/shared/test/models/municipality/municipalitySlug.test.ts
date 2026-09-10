import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assignMunicipalitySlugs } from '../../../src/models/municipality/municipalitySlug';
import { isReservedRootSegment, slugify } from '../../../src/utils/urls';

const muni = (id: string, name: string, province: string, codigoINE = id) => ({
  id,
  name,
  province,
  codigoINE,
});

describe('assignMunicipalitySlugs', () => {
  it('uses the bare name when it is unique', () => {
    expect(assignMunicipalitySlugs([muni('1', 'Matabuena', 'Segovia')]).get('1')).toBe('matabuena');
  });

  it('suffixes every holder of a shared name with its province', () => {
    const slugs = assignMunicipalitySlugs([
      muni('1', 'Moya', 'Barcelona'),
      muni('2', 'Moya', 'Cuenca'),
      muni('3', 'Moya', 'Las Palmas'),
    ]);
    expect([...slugs.values()].sort()).toEqual(['moya-barcelona', 'moya-cuenca', 'moya-las-palmas']);
  });

  it('never moves a slug already taken', () => {
    const slugs = assignMunicipalitySlugs([muni('2', 'Matabuena', 'Soria')], ['matabuena']);
    expect(slugs.get('2')).toBe('matabuena-soria');
  });

  it('avoids reserved route words', () => {
    expect(assignMunicipalitySlugs([muni('1', 'Descarga', 'Huesca')]).get('1')).toBe('descarga-huesca');
  });

  it('falls back to the INE code', () => {
    const slugs = assignMunicipalitySlugs([muni('9', 'Moya', 'Cuenca', '16140')], ['moya', 'moya-cuenca']);
    expect(slugs.get('9')).toBe('moya-16140');
  });

  it('gives all 8,167 INE municipalities a unique, unreserved slug', () => {
    const path = resolve(__dirname, '../../../../../scripts/data/municipalities-es.json');
    const dataset = JSON.parse(readFileSync(path, 'utf8')) as {
      name: string;
      province: string;
      codigoINE: string;
    }[];
    const slugs = assignMunicipalitySlugs(dataset.map((m) => ({ id: m.codigoINE, ...m })));
    const values = [...slugs.values()];
    expect(values).toHaveLength(dataset.length);
    expect(new Set(values).size).toBe(values.length);
    expect(values.some(isReservedRootSegment)).toBe(false);
    // Only the ~41 holders of a shared name carry a suffix — the rest stay bare.
    const suffixed = dataset.filter((m) => slugs.get(m.codigoINE) !== slugify(m.name));
    expect(suffixed.length).toBeGreaterThan(0);
    expect(suffixed.length).toBeLessThan(60);
    expect(suffixed.every((m) => slugs.get(m.codigoINE) === `${slugify(m.name)}-${slugify(m.province)}`)).toBe(true);
  });
});
