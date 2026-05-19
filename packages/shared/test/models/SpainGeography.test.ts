import { describe, it, expect } from 'vitest';
import {
  COUNTRIES,
  COMUNIDADES_AUTONOMAS,
  PROVINCIAS_BY_COMUNIDAD,
} from '../../src/models/municipality/SpainGeography';

describe('SpainGeography', () => {
  it('lists España as the only country', () => {
    expect(COUNTRIES).toEqual([{ code: 'ES', name: 'España' }]);
  });

  it('lists exactly 19 autonomous communities (17 + Ceuta + Melilla)', () => {
    expect(COMUNIDADES_AUTONOMAS).toHaveLength(19);
  });

  it('has a province entry for every comunidad autónoma', () => {
    for (const c of COMUNIDADES_AUTONOMAS) {
      expect(PROVINCIAS_BY_COMUNIDAD[c]).toBeDefined();
      expect(PROVINCIAS_BY_COMUNIDAD[c].length).toBeGreaterThan(0);
    }
  });

  it('contains Jaén under Andalucía and Madrid under Madrid', () => {
    expect(PROVINCIAS_BY_COMUNIDAD['Andalucía']).toContain('Jaén');
    expect(PROVINCIAS_BY_COMUNIDAD['Madrid']).toContain('Madrid');
  });
});
