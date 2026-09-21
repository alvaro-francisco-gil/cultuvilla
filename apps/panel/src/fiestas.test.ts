import { describe, it, expect } from 'vitest';
import type { FiestasDataset } from '@cultuvilla/shared/models';
import { ANILLO_LABEL, porAnillo, proximasFiestas } from './fiestas';

const dataset: FiestasDataset = {
  referencia: 'Matabuena',
  actualizado: '2026-09-21',
  nota: 'x',
  pueblos: [
    {
      nombre: 'Matabuena', provincia: 'Segovia', km: 0, habitantes: 204, anillo: 'referencia',
      fiestas: [
        { md: '07-25', nombre: 'Santiago', fuente: 'bop' },
        { md: '08-22', nombre: 'Fiestas de agosto', fuente: 'verificada', cuando: '22–28 de agosto' },
      ],
    },
    {
      nombre: 'Gallegos', provincia: 'Segovia', km: 3.4, habitantes: 96, anillo: '1',
      fiestas: [{ md: '10-05', nombre: 'Rosario', fuente: 'bop' }],
    },
    {
      nombre: 'Casla', provincia: 'Segovia', km: 11.5, habitantes: 155, anillo: '2',
      fiestas: [{ md: '09-29', nombre: 'San Miguel', fuente: 'bop' }],
    },
  ],
};

describe('proximasFiestas', () => {
  it('sorts by how soon the fiesta falls, not by distance', () => {
    const next = proximasFiestas(dataset, '2026-09-21');
    expect(next.map((f) => f.pueblo)).toEqual(['Casla', 'Gallegos', 'Matabuena', 'Matabuena']);
  });

  it('carries the resolved date and the day count', () => {
    const [first] = proximasFiestas(dataset, '2026-09-21');
    expect(first?.fecha).toBe('2026-09-29');
    expect(first?.dias).toBe(8);
  });

  // The reason the dates are stored as MM-DD: a fiesta that has already passed
  // this year is next year's, not a negative countdown.
  it('never returns a fiesta in the past', () => {
    expect(proximasFiestas(dataset, '2026-12-31').every((f) => f.dias >= 0)).toBe(true);
  });

  it('rolls a January fiesta into next year when asked in December', () => {
    const enero: FiestasDataset = {
      ...dataset,
      pueblos: [{ ...dataset.pueblos[0]!, fiestas: [{ md: '01-20', nombre: 'San Sebastián', fuente: 'bop' }] }],
    };
    const [first] = proximasFiestas(enero, '2026-12-21');
    expect(first?.fecha).toBe('2027-01-20');
    expect(first?.dias).toBe(30);
  });

  it('includes a fiesta happening today', () => {
    expect(proximasFiestas(dataset, '2026-09-29')[0]?.dias).toBe(0);
  });

  it('caps the list when a limit is given', () => {
    expect(proximasFiestas(dataset, '2026-09-21', 2)).toHaveLength(2);
  });
});

describe('porAnillo', () => {
  it('groups pueblos by ring, reference first, and orders each by distance', () => {
    const groups = porAnillo(dataset);
    expect(groups.map((g) => g.anillo)).toEqual(['referencia', '1', '2']);
    expect(groups[0]?.pueblos[0]?.nombre).toBe('Matabuena');
  });

  it('omits a ring with no pueblos rather than rendering an empty heading', () => {
    expect(porAnillo(dataset).some((g) => g.anillo === '3')).toBe(false);
  });

  it('labels every ring it can emit', () => {
    for (const group of porAnillo(dataset)) expect(ANILLO_LABEL[group.anillo]).toBeTruthy();
  });
});
