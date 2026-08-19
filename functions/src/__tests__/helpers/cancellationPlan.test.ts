import { describe, expect, it } from 'vitest';
import { resolveCancellation } from '../../helpers/cancellationPlan';

const OWNER = 'u_owner';
const GUEST = 'u_guest';
const STRANGER = 'u_stranger';

const solo = { userId: OWNER, groupId: null, groupOwnerId: null };
const ownerSeat = { userId: OWNER, groupId: 'g1', groupOwnerId: OWNER };
const claimedSeat = { userId: GUEST, groupId: 'g1', groupOwnerId: OWNER };

describe('resolveCancellation', () => {
  it('refuses a caller who neither holds the seat nor organizes the event', () => {
    expect(
      resolveCancellation({ uid: STRANGER, isOrganizer: false, registration: solo }),
    ).toBeNull();
  });

  it('deletes an ordinary registration held by the caller', () => {
    expect(resolveCancellation({ uid: OWNER, isOrganizer: false, registration: solo })).toEqual({
      action: 'delete-solo',
    });
  });

  it('takes the whole group when its owner cancels', () => {
    expect(
      resolveCancellation({ uid: OWNER, isOrganizer: false, registration: ownerSeat }),
    ).toEqual({ action: 'delete-group', groupId: 'g1' });
  });

  it('releases the seat back when a guest who claimed it drops out', () => {
    expect(
      resolveCancellation({ uid: GUEST, isOrganizer: false, registration: claimedSeat }),
    ).toEqual({ action: 'release-seat', groupId: 'g1' });
  });

  it('takes the whole group when an organizer removes any of its seats', () => {
    // A half-group is a state the sign-up path itself refuses to create, so
    // removing one seat must not leave one behind.
    expect(
      resolveCancellation({ uid: STRANGER, isOrganizer: true, registration: claimedSeat }),
    ).toEqual({ action: 'delete-group', groupId: 'g1' });
  });

  it('lets an organizer delete an ordinary registration outright', () => {
    expect(resolveCancellation({ uid: STRANGER, isOrganizer: true, registration: solo })).toEqual({
      action: 'delete-solo',
    });
  });

  it('never releases the owner’s own seat — that would strand the group', () => {
    const plan = resolveCancellation({ uid: OWNER, isOrganizer: false, registration: ownerSeat });
    expect(plan?.action).not.toBe('release-seat');
  });
});
