import { describe, it, expect } from 'vitest';
import { resolveFiestaDate, nextFiestaOccurrence, type Fiesta } from '../../src/models/business/BusinessSnapshot';

const fija = (md: string): Fiesta => ({ md, nombre: 'San Miguel', tipo: 'declarada', recurrencia: 'fija' });
const movil = (regla: Fiesta['regla'], md = '10-04'): Fiesta => ({
  md, nombre: 'Virgen del Rosario', tipo: 'declarada', recurrencia: 'movil', regla,
});

describe('resolveFiestaDate — fixed feasts', () => {
  it('returns the same calendar day every year', () => {
    expect(resolveFiestaDate(fija('09-29'), 2026)).toBe('2026-09-29');
    expect(resolveFiestaDate(fija('09-29'), 2031)).toBe('2031-09-29');
  });
});

describe('resolveFiestaDate — moveable feasts', () => {
  // The bug this exists for: "5 oct 2026" was the FIRST SUNDAY OF OCTOBER observed
  // on the Monday. Freezing it as 10-05 makes 2027 silently wrong.
  it('first Sunday of October moves year to year', () => {
    const rosario = movil({ n: 1, weekday: 7, month: 10 });
    expect(resolveFiestaDate(rosario, 2026)).toBe('2026-10-04');
    expect(resolveFiestaDate(rosario, 2027)).toBe('2027-10-03');
    expect(resolveFiestaDate(rosario, 2028)).toBe('2028-10-01');
  });

  it('second Sunday of October', () => {
    expect(resolveFiestaDate(movil({ n: 2, weekday: 7, month: 10 }), 2026)).toBe('2026-10-11');
  });

  it('third Saturday of June', () => {
    expect(resolveFiestaDate(movil({ n: 3, weekday: 6, month: 6 }), 2026)).toBe('2026-06-20');
  });

  it('last weekend of September (n = -1)', () => {
    expect(resolveFiestaDate(movil({ n: -1, weekday: 6, month: 9 }), 2026)).toBe('2026-09-26');
  });

  // "penúltimo fin de semana de agosto" — Gallegos. Second-to-last, not last.
  it('second-to-last Saturday of August (n = -2)', () => {
    expect(resolveFiestaDate(movil({ n: -2, weekday: 6, month: 8 }), 2026)).toBe('2026-08-22');
    expect(resolveFiestaDate(movil({ n: -2, weekday: 6, month: 8 }), 2027)).toBe('2027-08-21');
  });

  it('falls back to the stored anchor when a moveable feast has no rule', () => {
    expect(resolveFiestaDate({ ...movil(undefined), md: '08-17' }, 2027)).toBe('2027-08-17');
  });
});

describe('nextFiestaOccurrence', () => {
  it('uses the resolved date, not the stored anchor, for a moveable feast', () => {
    const rosario = movil({ n: 1, weekday: 7, month: 10 });
    expect(nextFiestaOccurrence(rosario, '2026-09-24')).toBe('2026-10-04');
  });

  it('rolls into next year once this year’s occurrence has passed', () => {
    const rosario = movil({ n: 1, weekday: 7, month: 10 });
    expect(nextFiestaOccurrence(rosario, '2026-10-05')).toBe('2027-10-03');
  });

  it('includes an occurrence happening today', () => {
    expect(nextFiestaOccurrence(fija('09-24'), '2026-09-24')).toBe('2026-09-24');
  });

  it('rolls a January fixed feast into next year when asked in December', () => {
    expect(nextFiestaOccurrence(fija('01-20'), '2026-12-21')).toBe('2027-01-20');
  });

  it('advances 29 February to a year where the day exists', () => {
    expect(nextFiestaOccurrence(fija('02-29'), '2026-09-24')).toBe('2028-02-29');
  });
});
