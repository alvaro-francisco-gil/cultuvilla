import {
  INITIAL_SOFT_ASK_STATE,
  MAX_SOFT_ASKS,
  MIN_MS_BETWEEN_ASKS,
  recordSoftAsk,
  shouldOfferSoftAsk,
} from '../softAskPolicy';

const NOW = 1_800_000_000_000;

describe('shouldOfferSoftAsk', () => {
  it('offers on a first sign-up when the OS has never been asked', () => {
    expect(
      shouldOfferSoftAsk({ trigger: 'event_signup', permission: 'undetermined', state: INITIAL_SOFT_ASK_STATE, now: NOW }),
    ).toBe(true);
  });

  it.each(['granted', 'denied', 'unsupported'] as const)(
    'never offers when permission is %s',
    (permission) => {
      // Denied especially: the OS dialog will not appear again, so a sheet
      // promising one would be a lie. Ajustes is the recovery path.
      expect(
        shouldOfferSoftAsk({ trigger: 'event_signup', permission, state: INITIAL_SOFT_ASK_STATE, now: NOW }),
      ).toBe(false);
    },
  );

  it(`stops after ${MAX_SOFT_ASKS} asks, ever`, () => {
    const state = { askCount: MAX_SOFT_ASKS, lastAskedAt: NOW - 365 * 24 * 3600 * 1000 };
    expect(shouldOfferSoftAsk({ trigger: 'event_signup', permission: 'undetermined', state, now: NOW })).toBe(false);
  });

  it('never asks twice in the same week', () => {
    const state = recordSoftAsk(INITIAL_SOFT_ASK_STATE, NOW);
    expect(
      shouldOfferSoftAsk({ trigger: 'event_signup', permission: 'undetermined', state, now: NOW + MIN_MS_BETWEEN_ASKS - 1 }),
    ).toBe(false);
    expect(
      shouldOfferSoftAsk({ trigger: 'event_signup', permission: 'undetermined', state, now: NOW + MIN_MS_BETWEEN_ASKS }),
    ).toBe(true);
  });

  it('lets a village join have only the FIRST ask; the second is reserved for a sign-up', () => {
    expect(
      shouldOfferSoftAsk({ trigger: 'village_join', permission: 'undetermined', state: INITIAL_SOFT_ASK_STATE, now: NOW }),
    ).toBe(true);
    const later = NOW + MIN_MS_BETWEEN_ASKS * 2;
    const state = recordSoftAsk(INITIAL_SOFT_ASK_STATE, NOW);
    expect(shouldOfferSoftAsk({ trigger: 'village_join', permission: 'undetermined', state, now: later })).toBe(false);
    expect(shouldOfferSoftAsk({ trigger: 'event_signup', permission: 'undetermined', state, now: later })).toBe(true);
  });
});

describe('recordSoftAsk', () => {
  it('counts the ask and stamps when it was shown', () => {
    expect(recordSoftAsk({ askCount: 1, lastAskedAt: 5 }, NOW)).toEqual({ askCount: 2, lastAskedAt: NOW });
  });
});
