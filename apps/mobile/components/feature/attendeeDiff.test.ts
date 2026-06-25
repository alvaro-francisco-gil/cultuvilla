import { computeRegistrationDiff } from './attendeeDiff';

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
