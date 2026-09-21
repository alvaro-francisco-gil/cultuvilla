import { describe, it, expect } from 'vitest';
import {
  BusinessSnapshotSchema,
  FiestaSourceSchema,
  daysBetweenIsoDates,
  nextOccurrence,
} from '../../src/models/business/BusinessSnapshot';

describe('nextOccurrence', () => {
  it('returns this year when the day is still ahead', () => {
    expect(nextOccurrence('10-04', '2026-09-21')).toBe('2026-10-04');
  });

  it('returns today when the fiesta is today', () => {
    expect(nextOccurrence('09-21', '2026-09-21')).toBe('2026-09-21');
  });

  // The trap this helper exists for: in late December, a January fiesta is next
  // year's, and a naive `${year}-${md}` would report it as 11 months past.
  it('rolls over to next year once the day has passed', () => {
    expect(nextOccurrence('01-20', '2026-12-21')).toBe('2027-01-20');
    expect(nextOccurrence('09-08', '2026-09-21')).toBe('2027-09-08');
  });

  // 2027, 2029 and 2030 have no 29 February; returning one would parse as NaN
  // downstream and render as "today".
  it('advances 29 February to a year where the day actually exists', () => {
    expect(nextOccurrence('02-29', '2026-09-21')).toBe('2028-02-29');
    expect(Number.isNaN(Date.parse(`${nextOccurrence('02-29', '2026-09-21')}T00:00:00Z`))).toBe(false);
  });

  it('refuses a malformed month-day instead of guessing', () => {
    expect(() => nextOccurrence('13-01', '2026-09-21')).toThrow();
    expect(() => nextOccurrence('0704', '2026-09-21')).toThrow();
  });
});

describe('daysBetweenIsoDates across a year boundary', () => {
  it('counts forward over new year', () => {
    expect(daysBetweenIsoDates('2026-12-21', '2027-01-20')).toBe(30);
  });
});

describe('FiestaSourceSchema', () => {
  it('admits only the two provenances the panel renders differently', () => {
    expect(FiestaSourceSchema.parse('bop')).toBe('bop');
    expect(FiestaSourceSchema.parse('verificada')).toBe('verificada');
    expect(FiestaSourceSchema.safeParse('supuesta').success).toBe(false);
  });
});

describe('BusinessSnapshotSchema fiestas', () => {
  const base = {
    generatedAt: '2026-09-21',
    counts: { convocatoria: 0, evento: 0, entidad: 0, propuesta: 0 },
    urgente: [],
    caducadas: [],
    propuestasIncompletas: [],
    byKind: { convocatoria: [], evento: [], entidad: [], propuesta: [] },
  };

  it('accepts a snapshot carrying pueblos', () => {
    const parsed = BusinessSnapshotSchema.parse({
      ...base,
      fiestas: {
        referencia: 'Matabuena',
        actualizado: '2026-09-21',
        nota: 'El BOP no es la semana de fiestas.',
        pueblos: [
          {
            nombre: 'Gallegos',
            provincia: 'Segovia',
            km: 3.4,
            habitantes: 96,
            anillo: '1',
            fiestas: [{ md: '06-24', nombre: 'San Juan', fuente: 'bop' }],
          },
        ],
      },
    });
    expect(parsed.fiestas?.pueblos[0]?.nombre).toBe('Gallegos');
  });

  // The registry shipped before fiestas existed; an older snapshot.json must not
  // fail to parse just because the panel learned a new section.
  it('treats fiestas as optional', () => {
    expect(BusinessSnapshotSchema.parse(base).fiestas).toBeUndefined();
  });

  it('rejects a month-day that is not MM-DD', () => {
    const bad = {
      ...base,
      fiestas: {
        referencia: 'Matabuena',
        actualizado: '2026-09-21',
        nota: 'x',
        pueblos: [
          { nombre: 'X', provincia: 'Segovia', km: 1, habitantes: 1, anillo: '1',
            fiestas: [{ md: '6-24', nombre: 'San Juan', fuente: 'bop' }] },
        ],
      },
    };
    expect(BusinessSnapshotSchema.safeParse(bad).success).toBe(false);
  });
});
