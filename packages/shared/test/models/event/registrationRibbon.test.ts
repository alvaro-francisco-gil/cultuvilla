import { describe, expect, it } from 'vitest';
import {
  resolveRegistrationRibbon,
  tallyRegistrationsByEvent,
  type RegistrationRibbon,
  type RegistrationTally,
} from '../../../src/models/event/RegistrationRibbonModel';

describe('resolveRegistrationRibbon', () => {
  const cases: [string, RegistrationTally, RegistrationRibbon | null][] = [
    ['no registrations', { confirmed: 0, waitlisted: 0 }, null],
    ['one confirmed', { confirmed: 1, waitlisted: 0 }, { kind: 'confirmed', count: 1 }],
    ['three confirmed', { confirmed: 3, waitlisted: 0 }, { kind: 'confirmed', count: 3 }],
    ['one waitlisted', { confirmed: 0, waitlisted: 1 }, { kind: 'waitlisted', count: 1 }],
    ['three waitlisted', { confirmed: 0, waitlisted: 3 }, { kind: 'waitlisted', count: 3 }],
    [
      'one of each',
      { confirmed: 1, waitlisted: 1 },
      { kind: 'mixed', confirmed: 1, waitlisted: 1 },
    ],
    [
      'two confirmed and one waiting',
      { confirmed: 2, waitlisted: 1 },
      { kind: 'mixed', confirmed: 2, waitlisted: 1 },
    ],
  ];

  it.each(cases)('%s', (_label, tally, expected) => {
    expect(resolveRegistrationRibbon(tally)).toEqual(expected);
  });

  // The mixed ribbon draws one count per half of the band, so it must never
  // collapse them into a total — a reader has to be able to tell which of the
  // household is in and which is queued.
  it('keeps the two counts separate in the mixed state', () => {
    const ribbon = resolveRegistrationRibbon({ confirmed: 2, waitlisted: 3 });
    expect(ribbon).toEqual({ kind: 'mixed', confirmed: 2, waitlisted: 3 });
  });

  it('treats negative or fractional counts as nothing to show', () => {
    expect(resolveRegistrationRibbon({ confirmed: -1, waitlisted: 0 })).toBeNull();
    expect(resolveRegistrationRibbon({ confirmed: 0.5, waitlisted: 0 })).toBeNull();
  });
});

describe('tallyRegistrationsByEvent', () => {
  it('groups a flat registration list into one tally per event', () => {
    const tallies = tallyRegistrationsByEvent([
      { eventId: 'a', status: 'confirmed' },
      { eventId: 'a', status: 'confirmed' },
      { eventId: 'a', status: 'waitlisted' },
      { eventId: 'b', status: 'waitlisted' },
    ]);

    expect(tallies.get('a')).toEqual({ confirmed: 2, waitlisted: 1 });
    expect(tallies.get('b')).toEqual({ confirmed: 0, waitlisted: 1 });
    expect(tallies.get('c')).toBeUndefined();
  });

  it('returns an empty map for an empty list', () => {
    expect(tallyRegistrationsByEvent([]).size).toBe(0);
  });

  it('feeds resolveRegistrationRibbon directly', () => {
    const tallies = tallyRegistrationsByEvent([
      { eventId: 'a', status: 'confirmed' },
      { eventId: 'a', status: 'waitlisted' },
    ]);
    const tally = tallies.get('a');
    expect(tally).toBeDefined();
    expect(resolveRegistrationRibbon(tally ?? { confirmed: 0, waitlisted: 0 })).toEqual({
      kind: 'mixed',
      confirmed: 1,
      waitlisted: 1,
    });
  });
});
