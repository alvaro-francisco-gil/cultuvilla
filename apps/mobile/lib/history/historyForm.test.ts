import {
  draftFromDate,
  emptyDateDraft,
  parseDateDraft,
  validateHistoryDates,
  type HistoricalDateDraft,
} from './historyForm';

const draft = (over: Partial<HistoricalDateDraft>): HistoricalDateDraft => ({
  ...emptyDateDraft(),
  ...over,
});

describe('parseDateDraft', () => {
  it('reads a bare year', () => {
    expect(parseDateDraft(draft({ year: '1212' }))).toEqual({
      date: { year: 1212, month: null, day: null },
    });
  });

  it('reads a full date', () => {
    expect(parseDateDraft(draft({ year: '1902', month: 8, day: '14' }))).toEqual({
      date: { year: 1902, month: 8, day: 14 },
    });
  });

  it('negates a year before Christ', () => {
    expect(parseDateDraft(draft({ year: '218', bc: true }))).toEqual({
      date: { year: -218, month: null, day: null },
    });
  });

  it('ignores a day typed without a month', () => {
    expect(parseDateDraft(draft({ year: '1900', day: '3' }))).toEqual({
      date: { year: 1900, month: null, day: null },
    });
  });

  it('requires a year', () => {
    expect(parseDateDraft(draft({}))).toEqual({ error: 'yearRequired' });
  });

  it('rejects year 0', () => {
    expect(parseDateDraft(draft({ year: '0' }))).toEqual({ error: 'yearZero' });
  });

  it('rejects a day that does not exist', () => {
    expect(parseDateDraft(draft({ year: '1900', month: 2, day: '30' }))).toEqual({
      error: 'dayInvalid',
    });
  });
});

describe('draftFromDate', () => {
  it('round-trips through parseDateDraft, BC included', () => {
    for (const date of [
      { year: 1212, month: null, day: null },
      { year: -218, month: 6, day: null },
      { year: 1902, month: 8, day: 14 },
    ]) {
      expect(parseDateDraft(draftFromDate(date))).toEqual({ date });
    }
  });
});

describe('validateHistoryDates', () => {
  it('returns a point in time when not a range', () => {
    expect(
      validateHistoryDates({ start: draft({ year: '1936' }), isRange: false, end: draft({ year: '1' }) }),
    ).toEqual({ start: { year: 1936, month: null, day: null }, end: null });
  });

  it('returns a range', () => {
    expect(
      validateHistoryDates({ start: draft({ year: '1936' }), isRange: true, end: draft({ year: '1939' }) }),
    ).toEqual({
      start: { year: 1936, month: null, day: null },
      end: { year: 1939, month: null, day: null },
    });
  });

  it('rejects a range that ends before it starts', () => {
    expect(
      validateHistoryDates({ start: draft({ year: '1939' }), isRange: true, end: draft({ year: '1936' }) }),
    ).toEqual({ error: 'endBeforeStart' });
  });

  it('reports an end-date problem as its own error', () => {
    expect(
      validateHistoryDates({ start: draft({ year: '1939' }), isRange: true, end: draft({}) }),
    ).toEqual({ error: 'endYearRequired' });
  });
});
