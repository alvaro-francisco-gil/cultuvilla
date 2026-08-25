import { computeRegistrationDiff, outOfRangeAttendeeNames } from './attendeeDiff';

describe('computeRegistrationDiff', () => {
  it('adds newly-selected personas, cancels deselected ones, leaves unchanged alone', () => {
    const selected = new Set(['self', 'dep1']);
    const registered = new Map([
      ['self', { regId: 'rA', status: 'confirmed' as const }],
      ['dep2', { regId: 'rB', status: 'waitlisted' as const }],
    ]);
    const names = new Map([
      ['self', 'Ana'],
      ['dep1', 'Hijo'],
      ['dep2', 'Abuela'],
    ]);

    const diff = computeRegistrationDiff(selected, registered, names);

    // dep1 is freshly selected → add; self stays registered → no-op.
    expect(diff.toAdd).toEqual([{ personId: 'dep1', name: 'Hijo' }]);
    // dep2 was registered but is no longer selected → cancel by its regId.
    expect(diff.toCancelRegIds).toEqual(['rB']);
  });

  it('returns empty diffs when the selection matches the registered set', () => {
    const selected = new Set(['self']);
    const registered = new Map([['self', { regId: 'rA', status: 'confirmed' as const }]]);
    const names = new Map([['self', 'Ana']]);

    const diff = computeRegistrationDiff(selected, registered, names);

    expect(diff.toAdd).toEqual([]);
    expect(diff.toCancelRegIds).toEqual([]);
  });
});
describe('outOfRangeAttendeeNames', () => {
  const names = new Map([
    ['p1', 'Ana'],
    ['p2', 'Hijo'],
    ['p3', 'Abuela'],
  ]);
  const years = new Map<string, number | null>([
    ['p1', 1985],
    ['p2', 2016],
    ['p3', null],
  ]);
  const kids = { minBirthYear: 2014, maxBirthYear: 2020 };

  it('is empty when the event advertises no window', () => {
    const window = { minBirthYear: null, maxBirthYear: null };
    expect(outOfRangeAttendeeNames(window, ['p1', 'p2'], years, names)).toEqual([]);
  });

  it('names only the personas whose known year falls outside', () => {
    expect(outOfRangeAttendeeNames(kids, ['p1', 'p2'], years, names)).toEqual(['Ana']);
  });

  it('leaves a persona with no recorded year alone', () => {
    expect(outOfRangeAttendeeNames(kids, ['p3'], years, names)).toEqual([]);
  });

  it('treats a persona missing from the year map as unknown, not out of range', () => {
    expect(outOfRangeAttendeeNames(kids, ['p9'], years, names)).toEqual([]);
  });
});
