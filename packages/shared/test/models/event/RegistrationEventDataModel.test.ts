import { describe, it, expect } from 'vitest';
import {
  buildRegistrationEventData,
  RegistrationEventDataSchema,
  RegistrationEventActionSchema,
} from '../../../src/models/event/RegistrationEventDataModel';

const base = {
  registrationId: 'reg-1',
  action: 'removed_by_organizer' as const,
  actorUserId: 'organizer-1',
  subjectUserId: 'user-1',
  personId: 'person-1',
  name: 'Lucía',
  status: 'confirmed' as const,
};

describe('buildRegistrationEventData', () => {
  it('produces a doc that parses under the strict converter schema', () => {
    expect(() => RegistrationEventDataSchema.parse(buildRegistrationEventData(base))).not.toThrow();
  });

  it('defaults groupId to null so an individual registration needs no ceremony', () => {
    expect(buildRegistrationEventData(base).groupId).toBeNull();
  });

  it('stamps `at` with the current time when the caller does not supply one', () => {
    const before = Date.now();
    const at = buildRegistrationEventData(base).at;
    expect(at.getTime()).toBeGreaterThanOrEqual(before);
    expect(at.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('keeps an explicit `at`, so an entry can carry the mutation it records', () => {
    const at = new Date('2026-01-02T03:04:05Z');
    expect(buildRegistrationEventData({ ...base, at }).at).toEqual(at);
  });

  it('carries the group a cancelled seat belonged to', () => {
    const built = buildRegistrationEventData({
      ...base,
      action: 'group_cancelled',
      groupId: 'group-9',
    });
    expect(built).toMatchObject({ action: 'group_cancelled', groupId: 'group-9' });
  });

  it('rejects an action outside the roster-membership vocabulary', () => {
    // The ops toggles are deliberately NOT loggable here — see the model.
    expect(RegistrationEventActionSchema.safeParse('checked_in').success).toBe(false);
    expect(RegistrationEventActionSchema.safeParse('marked_paid').success).toBe(false);
  });

  it('covers every roster-membership transition the callables can perform', () => {
    expect(RegistrationEventActionSchema.options).toEqual([
      'signed_up',
      'walk_in_added',
      'seat_claimed',
      'waitlist_promoted',
      'cancelled_self',
      'removed_by_organizer',
      'group_cancelled',
      'seat_released',
      'signups_disabled',
    ]);
  });
});
