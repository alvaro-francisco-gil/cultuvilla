import { describe, it, expect } from 'vitest';
import {
  BusinessSnapshotSchema,
  FiestaTipoSchema,
  FiestasDatasetSchema,
  daysBetweenIsoDates,
} from '../../src/models/business/BusinessSnapshot';

const base = {
  generatedAt: '2026-09-24',
  counts: { convocatoria: 0, evento: 0, entidad: 0, propuesta: 0 },
  urgente: [],
  caducadas: [],
  propuestasIncompletas: [],
  byKind: { convocatoria: [], evento: [], entidad: [], propuesta: [] },
};

const cobertura = {
  radioKm: 20,
  centro: { nombre: 'Matabuena', lat: 41.095833, lon: -3.757222 },
  metodo: 'ortodrómica entre centroides (Wikidata P625)',
  barridos: [{ fecha: '2026-09-21', radioKm: 20, provincias: ['Segovia'], anioBop: 2026, pueblosHallados: 1 }],
};

const dataset = {
  referencia: 'Matabuena',
  actualizado: '2026-09-21',
  anioBop: 2026,
  nota: 'El boletín no es la semana de fiestas.',
  cobertura,
  pueblos: [
    {
      nombre: 'Gallegos', provincia: 'Segovia', km: 3.4, habitantes: 96, anillo: '1',
      fiestas: [{
        md: '06-24', nombre: 'San Juan', tipo: 'declarada', recurrencia: 'fija',
        fuente: 'BOP Segovia 19-09-2025', verificadoEl: '2026-09-21',
      }],
      confirmar: ['[[confirmar: semana de fiestas real de Gallegos]]'],
    },
  ],
};

describe('daysBetweenIsoDates across a year boundary', () => {
  it('counts forward over new year', () => {
    expect(daysBetweenIsoDates('2026-12-21', '2027-01-20')).toBe(30);
  });
});

describe('FiestaTipoSchema', () => {
  it('admits only the two provenances the panel renders differently', () => {
    expect(FiestaTipoSchema.parse('declarada')).toBe('declarada');
    expect(FiestaTipoSchema.parse('verificada')).toBe('verificada');
    expect(FiestaTipoSchema.safeParse('bop').success).toBe(false);
  });
});

describe('FiestasDatasetSchema', () => {
  it('accepts a dataset with coverage and citations', () => {
    expect(FiestasDatasetSchema.parse(dataset).pueblos[0]?.nombre).toBe('Gallegos');
  });

  // Coverage is what makes absence meaningful: a 20 km sweep and a 300 km sweep
  // produce identical-looking files without it.
  it('rejects a dataset with no coverage', () => {
    const { cobertura: _drop, ...sinCobertura } = dataset;
    expect(FiestasDatasetSchema.safeParse(sinCobertura).success).toBe(false);
  });

  it('rejects a sweep that records no radius', () => {
    const bad = { ...dataset, cobertura: { ...cobertura, barridos: [{ fecha: '2026-09-21', provincias: ['Segovia'], anioBop: 2026, pueblosHallados: 1 }] } };
    expect(FiestasDatasetSchema.safeParse(bad).success).toBe(false);
  });

  /** One pueblo, one fiesta, with the fiesta's fields overridden or removed. */
  const withFiesta = (fiesta: Record<string, unknown>): unknown => ({
    ...dataset,
    pueblos: [{ ...dataset.pueblos[0], fiestas: [fiesta] }],
  });
  const fiesta = dataset.pueblos[0]?.fiestas[0] ?? {};

  // A `verificada` with no retraceable source claims an authority it lacks.
  it('rejects a fiesta with no fuente', () => {
    const { fuente: _drop, ...sinFuente } = fiesta;
    expect(FiestasDatasetSchema.safeParse(withFiesta(sinFuente)).success).toBe(false);
  });

  it('rejects a fiesta with no verificadoEl', () => {
    const { verificadoEl: _drop, ...sinFecha } = fiesta;
    expect(FiestasDatasetSchema.safeParse(withFiesta(sinFecha)).success).toBe(false);
  });

  it('rejects a month-day that is not MM-DD', () => {
    expect(FiestasDatasetSchema.safeParse(withFiesta({ ...fiesta, md: '6-24' })).success).toBe(false);
  });

  it('rejects a recurrence rule with a zero occurrence', () => {
    const bad = withFiesta({ ...fiesta, recurrencia: 'movil', regla: { n: 0, weekday: 7, month: 10 } });
    expect(FiestasDatasetSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a weekday outside the ISO range', () => {
    const bad = withFiesta({ ...fiesta, recurrencia: 'movil', regla: { n: 1, weekday: 0, month: 10 } });
    expect(FiestasDatasetSchema.safeParse(bad).success).toBe(false);
  });
});

describe('BusinessSnapshotSchema fiestas', () => {
  it('accepts a snapshot carrying the dataset', () => {
    expect(BusinessSnapshotSchema.parse({ ...base, fiestas: dataset }).fiestas?.cobertura.radioKm).toBe(20);
  });

  // The registry shipped before fiestas existed; an older snapshot must still
  // parse rather than blanking the whole panel over a new section.
  it('treats fiestas as optional', () => {
    expect(BusinessSnapshotSchema.parse(base).fiestas).toBeUndefined();
  });
});

describe('FiestasDatasetSchema rejects impossible dates', () => {
  const withFiesta = (fiesta: Record<string, unknown>): unknown => ({
    ...dataset,
    pueblos: [{ ...dataset.pueblos[0], fiestas: [fiesta] }],
  });
  const fiesta = dataset.pueblos[0]?.fiestas[0] ?? {};

  // Shape alone would admit these; they reach Date.parse as NaN downstream and
  // render as "today" — a fabricated fiesta rather than a rejected dataset.
  it.each(['99-99', '02-31', '00-10', '13-01', '06-00'])('rejects md %s', (md) => {
    expect(FiestasDatasetSchema.safeParse(withFiesta({ ...fiesta, md })).success).toBe(false);
  });

  // A month-day carries no year, so 29 February is legitimate here;
  // nextFiestaOccurrence advances it to a leap year.
  it('accepts 02-29, which is a real day in a leap year', () => {
    expect(FiestasDatasetSchema.safeParse(withFiesta({ ...fiesta, md: '02-29' })).success).toBe(true);
  });

  it.each(['2026-02-31', '2027-02-29', '2026-13-01', '2026-00-10'])('rejects verificadoEl %s', (verificadoEl) => {
    expect(FiestasDatasetSchema.safeParse(withFiesta({ ...fiesta, verificadoEl })).success).toBe(false);
  });

  it('rejects an impossible actualizado or barrido date', () => {
    expect(FiestasDatasetSchema.safeParse({ ...dataset, actualizado: '2026-02-30' }).success).toBe(false);
    const badBarrido = { ...dataset, cobertura: { ...cobertura, barridos: [{ ...cobertura.barridos[0], fecha: '2026-06-31' }] } };
    expect(FiestasDatasetSchema.safeParse(badBarrido).success).toBe(false);
  });

  // Every ratio computed from an empty dataset is undefined, and the panel would
  // render 0/0 as fully verified.
  it('rejects a dataset with no pueblos', () => {
    expect(FiestasDatasetSchema.safeParse({ ...dataset, pueblos: [] }).success).toBe(false);
  });

  // But a pueblo with no fiestas is the whole point of recording coverage: found
  // inside the radius, nothing published yet.
  it('accepts a pueblo with no fiestas but an open marker', () => {
    const blank = { ...dataset, pueblos: [{ ...dataset.pueblos[0], fiestas: [], confirmar: ['[[confirmar: nada publicado]]'] }] };
    expect(FiestasDatasetSchema.safeParse(blank).success).toBe(true);
  });
});
