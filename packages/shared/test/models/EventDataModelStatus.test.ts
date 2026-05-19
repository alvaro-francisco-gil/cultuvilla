import { describe, it, expect } from 'vitest';
import { GeoPoint } from 'firebase/firestore';
import {
  buildEventData,
  isEventFull,
  isEventSignupOpen,
} from '../../src/models/event/EventDataModel';

function makeEvent(overrides: Partial<Parameters<typeof buildEventData>[0]> = {}) {
  return buildEventData({
    title: 'E',
    description: 'D',
    startDate: new Date('2026-08-01'),
    location: { type: 'text', coordinates: null, text: 'plaza' },
    organizationId: 'org1',
    organizationName: 'Org',
    createdBy: 'u1',
    villageId: 'v1',
    villageName: 'V',
    villageCoordinates: new GeoPoint(0, 0),
    ...overrides,
  });
}

describe('isEventFull', () => {
  it('returns false when maxAttendees is null (uncapped)', () => {
    const e = makeEvent({ maxAttendees: null });
    expect(isEventFull(e, 9999)).toBe(false);
  });

  it('returns false when confirmedCount is below maxAttendees', () => {
    const e = makeEvent({ maxAttendees: 50 });
    expect(isEventFull(e, 49)).toBe(false);
  });

  it('returns true when confirmedCount equals maxAttendees', () => {
    const e = makeEvent({ maxAttendees: 50 });
    expect(isEventFull(e, 50)).toBe(true);
  });

  it('returns true when confirmedCount exceeds maxAttendees', () => {
    const e = makeEvent({ maxAttendees: 50 });
    expect(isEventFull(e, 51)).toBe(true);
  });
});

describe('isEventSignupOpen', () => {
  it('returns true only when status is published', () => {
    expect(isEventSignupOpen(makeEvent({ status: 'published' }))).toBe(true);
    expect(isEventSignupOpen(makeEvent({ status: 'draft' }))).toBe(false);
    expect(isEventSignupOpen(makeEvent({ status: 'cancelled' }))).toBe(false);
    expect(isEventSignupOpen(makeEvent({ status: 'completed' }))).toBe(false);
  });
});
