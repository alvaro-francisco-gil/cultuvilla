import { describe, it, expect } from 'vitest';
import type { BusinessCard } from '@cultuvilla/shared/models';
import { buildMonths, datedItems, itemsAfterWindow, itemsBeforeWindow, WEEKDAYS } from './calendar';

const card = (id: string, deadline?: string): BusinessCard => ({
  path: `project/convocatorias/${id}.md`,
  holes: 0,
  id,
  kind: 'convocatoria',
  titulo: id,
  ...(deadline ? { deadline } : {}),
});

const TODAY = '2026-09-21';

describe('datedItems', () => {
  it('keeps only dated records, soonest first', () => {
    const items = datedItems([card('b', '2026-10-09'), card('sin-fecha'), card('a', '2026-09-23')]);
    expect(items.map((i) => i.card.id)).toEqual(['a', 'b']);
  });

  it('is empty when nothing carries a deadline', () => {
    expect(datedItems([card('x'), card('y')])).toEqual([]);
  });
});

describe('buildMonths', () => {
  const items = datedItems([card('galera', '2026-10-09'), card('chispa', '2026-09-27'), card('lejano', '2027-03-01')]);

  it('starts at the current month and runs the requested length', () => {
    const months = buildMonths(items, TODAY, 3);
    expect(months.map((m) => m.key)).toEqual(['2026-09', '2026-10', '2026-11']);
  });

  it('rolls over the year boundary', () => {
    const months = buildMonths([], '2026-12-15', 3);
    expect(months.map((m) => m.key)).toEqual(['2026-12', '2027-01', '2027-02']);
  });

  it('labels months in Spanish', () => {
    expect(buildMonths([], TODAY, 1)[0]?.label).toBe('septiembre 2026');
  });

  it('is Monday-first and always a whole number of weeks', () => {
    expect(WEEKDAYS[0]).toBe('L');
    for (const month of buildMonths(items, TODAY, 4)) {
      expect(month.days.length % 7).toBe(0);
    }
  });

  it('places the 1st under its real weekday', () => {
    // 1 September 2026 is a Tuesday, so exactly one leading blank.
    const september = buildMonths([], '2026-09-01', 1)[0];
    const leading = september?.days.findIndex((d) => d.day === 1);
    expect(leading).toBe(1);
  });

  it('gives February the right length in a non-leap year', () => {
    const february = buildMonths([], '2027-02-01', 1)[0];
    expect(february?.days.filter((d) => d.day !== null)).toHaveLength(28);
  });

  it('attaches each item to its own day and nowhere else', () => {
    const september = buildMonths(items, TODAY, 3)[0];
    const marked = september?.days.filter((d) => d.items.length > 0) ?? [];
    expect(marked).toHaveLength(1);
    expect(marked[0]?.date).toBe('2026-09-27');
    expect(marked[0]?.items[0]?.card.id).toBe('chispa');
  });

  it('marks today and distinguishes past days', () => {
    const september = buildMonths(items, TODAY, 1)[0];
    expect(september?.days.filter((d) => d.isToday)).toHaveLength(1);
    expect(september?.days.find((d) => d.date === '2026-09-20')?.isPast).toBe(true);
    expect(september?.days.find((d) => d.date === TODAY)?.isPast).toBe(false);
    expect(september?.days.find((d) => d.date === '2026-09-22')?.isPast).toBe(false);
  });

  it('never marks a blank cell as today or past', () => {
    for (const month of buildMonths(items, TODAY, 3)) {
      for (const day of month.days.filter((d) => d.date === null)) {
        expect(day.isToday).toBe(false);
        expect(day.isPast).toBe(false);
      }
    }
  });

  it('renders an empty month without inventing items', () => {
    const november = buildMonths(items, TODAY, 3)[2];
    expect(november?.items).toEqual([]);
    expect(november?.days.every((d) => d.items.length === 0)).toBe(true);
  });
});

describe('window overflow', () => {
  const items = datedItems([
    card('viejo', '2026-01-10'),
    card('chispa', '2026-09-27'),
    card('lejano', '2027-03-01'),
  ]);
  const months = buildMonths(items, TODAY, 3);

  it('reports what falls beyond the last rendered month, so nothing is lost', () => {
    expect(itemsAfterWindow(items, months).map((i) => i.card.id)).toEqual(['lejano']);
  });

  it('reports what fell before the first rendered month', () => {
    expect(itemsBeforeWindow(items, months).map((i) => i.card.id)).toEqual(['viejo']);
  });

  it('counts an item inside the window in neither overflow list', () => {
    expect(itemsAfterWindow(items, months).some((i) => i.card.id === 'chispa')).toBe(false);
    expect(itemsBeforeWindow(items, months).some((i) => i.card.id === 'chispa')).toBe(false);
  });

  it('treats a deadline on the last day of the window as inside it', () => {
    const edge = datedItems([card('borde', '2026-11-30')]);
    expect(itemsAfterWindow(edge, buildMonths(edge, TODAY, 3))).toEqual([]);
  });
});
