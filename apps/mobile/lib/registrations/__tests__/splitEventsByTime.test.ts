import { splitEventsByTime } from '../splitEventsByTime';

type Row = { id: string; startDate: Date; endDate: Date | null };

const NOW = new Date('2026-06-15T12:00:00Z');

function row(id: string, start: string, end?: string): Row {
  return { id, startDate: new Date(start), endDate: end ? new Date(end) : null };
}

const ids = (rows: readonly Row[]) => rows.map((r) => r.id);

describe('splitEventsByTime', () => {
  it('puts events whose day has passed under past and the rest under upcoming', () => {
    const { upcoming, past } = splitEventsByTime(
      [row('yesterday', '2026-06-14T20:00:00Z'), row('tomorrow', '2026-06-16T09:00:00Z')],
      NOW,
    );

    expect(ids(upcoming)).toEqual(['tomorrow']);
    expect(ids(past)).toEqual(['yesterday']);
  });

  it('keeps an event that already started today under upcoming', () => {
    const { upcoming, past } = splitEventsByTime([row('this-morning', '2026-06-15T08:00:00Z')], NOW);

    expect(ids(upcoming)).toEqual(['this-morning']);
    expect(past).toEqual([]);
  });

  it('keeps a multi-day event under upcoming until its end date is over', () => {
    const { upcoming, past } = splitEventsByTime(
      [row('fiestas', '2026-06-12T10:00:00Z', '2026-06-17T23:00:00Z')],
      NOW,
    );

    expect(ids(upcoming)).toEqual(['fiestas']);
    expect(past).toEqual([]);
  });

  it('orders upcoming soonest-first', () => {
    const { upcoming } = splitEventsByTime(
      [
        row('far', '2026-09-01T10:00:00Z'),
        row('near', '2026-06-16T10:00:00Z'),
        row('mid', '2026-07-01T10:00:00Z'),
      ],
      NOW,
    );

    expect(ids(upcoming)).toEqual(['near', 'mid', 'far']);
  });

  it('orders past most-recent-first', () => {
    const { past } = splitEventsByTime(
      [
        row('old', '2026-01-10T10:00:00Z'),
        row('recent', '2026-06-13T10:00:00Z'),
        row('mid', '2026-03-20T10:00:00Z'),
      ],
      NOW,
    );

    expect(ids(past)).toEqual(['recent', 'mid', 'old']);
  });

  it('sorts past by the end boundary, not the start date', () => {
    const { past } = splitEventsByTime(
      [
        row('long-run', '2026-05-01T10:00:00Z', '2026-06-14T12:00:00Z'),
        row('single-day', '2026-06-10T10:00:00Z'),
      ],
      NOW,
    );

    expect(ids(past)).toEqual(['long-run', 'single-day']);
  });

  it('returns empty lists for no registrations', () => {
    expect(splitEventsByTime([], NOW)).toEqual({ upcoming: [], past: [] });
  });
});
