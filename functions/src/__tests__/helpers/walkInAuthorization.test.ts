import { describe, it, expect } from 'vitest';
import { isWalkInAuthorized } from '../../helpers/walkInAuthorization';

describe('isWalkInAuthorized', () => {
  it('allows a user in organizerUserIds', () => {
    expect(
      isWalkInAuthorized({
        uid: 'organizer-1',
        organizerUserIds: ['organizer-1', 'organizer-2'],
        isVillageAdmin: false,
        isAppAdmin: false,
      }),
    ).toBe(true);
  });

  it('denies an org member not in organizerUserIds (orgs are display-only)', () => {
    expect(
      isWalkInAuthorized({
        uid: 'org-member',
        organizerUserIds: ['organizer-1'],
        isVillageAdmin: false,
        isAppAdmin: false,
      }),
    ).toBe(false);
  });

  it('allows a village admin even if not in organizerUserIds', () => {
    expect(
      isWalkInAuthorized({
        uid: 'village-admin',
        organizerUserIds: ['organizer-1'],
        isVillageAdmin: true,
        isAppAdmin: false,
      }),
    ).toBe(true);
  });

  it('allows an app admin even if not in organizerUserIds', () => {
    expect(
      isWalkInAuthorized({
        uid: 'app-admin',
        organizerUserIds: ['organizer-1'],
        isVillageAdmin: false,
        isAppAdmin: true,
      }),
    ).toBe(true);
  });

  it('denies a random village member not in organizerUserIds', () => {
    expect(
      isWalkInAuthorized({
        uid: 'random-user',
        organizerUserIds: ['organizer-1'],
        isVillageAdmin: false,
        isAppAdmin: false,
      }),
    ).toBe(false);
  });
});
