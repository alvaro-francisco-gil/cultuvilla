import { diasHasta, snapshotAgeDays, sourceUrl, snapshot } from './snapshot';

describe('snapshotAgeDays', () => {
  it('is 0 on the day the snapshot was generated', () => {
    expect(snapshotAgeDays('2026-09-21', new Date('2026-09-21T23:00:00Z'))).toBe(0);
  });

  it('counts whole days since generation', () => {
    expect(snapshotAgeDays('2026-09-21', new Date('2026-09-28T01:00:00Z'))).toBe(7);
  });

  it('never reports a negative age when the clock is behind the build', () => {
    expect(snapshotAgeDays('2026-09-21', new Date('2026-09-19T00:00:00Z'))).toBe(0);
  });

  it('is unaffected by a DST change inside the window', () => {
    expect(snapshotAgeDays('2026-10-01', new Date('2026-11-01T12:00:00Z'))).toBe(31);
  });

  it('returns 0 rather than NaN on a malformed date', () => {
    expect(snapshotAgeDays('no-es-una-fecha')).toBe(0);
  });
});

describe('diasHasta', () => {
  it('counts forward to a future deadline', () => {
    expect(diasHasta('2026-09-27', new Date('2026-09-21T10:00:00Z'))).toBe(6);
  });

  it('is 0 on the deadline itself, whatever the time of day', () => {
    expect(diasHasta('2026-09-21', new Date('2026-09-21T23:59:00Z'))).toBe(0);
  });

  it('goes negative once the deadline has passed', () => {
    expect(diasHasta('2026-09-07', new Date('2026-09-21T00:00:00Z'))).toBe(-14);
  });
});

describe('sourceUrl', () => {
  it('points at the record Markdown on the develop branch', () => {
    const url = sourceUrl({ path: 'project/eventos/galera.md', holes: 0, id: 'galera', kind: 'evento', titulo: 'Galera' });
    expect(url).toBe('https://github.com/alvaro-francisco-gil/cultuvilla/blob/develop/project/eventos/galera.md');
  });
});

describe('the committed snapshot', () => {
  it('carries every kind the dashboard renders', () => {
    for (const kind of ['convocatoria', 'evento', 'entidad', 'propuesta'] as const) {
      expect(Array.isArray(snapshot.byKind[kind])).toBe(true);
      expect(snapshot.counts[kind]).toBe(snapshot.byKind[kind].length);
    }
  });

  it('gives every card a path, so no card can be a dead link', () => {
    const all = Object.values(snapshot.byKind).flat();
    expect(all.length).toBeGreaterThan(0);
    for (const card of all) expect(card.path).toMatch(/^project\/.+\.md$/);
  });

  it('stamps a plain ISO date, so regenerating on the same day makes no diff', () => {
    expect(snapshot.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
