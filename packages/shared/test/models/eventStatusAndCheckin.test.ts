import { describe, it, expect } from 'vitest';
import { EventDataSchema } from '../../src/models/event/EventDataModel';
import { RegistrationDataSchema, buildRegistrationData } from '../../src/models/event/RegistrationDataModel';

const baseEvent = {
  title: 'Fiesta', description: 'x', startDate: new Date(), endDate: null,
  location: { coordinates: { lat: 40.4, lng: -3.7 }, displayName: 'Plaza' }, imageURL: null, maxAttendees: null,
  telephoneRequired: false, status: 'published', organizerUserIds: ['u1'], organizerOrgIds: [],
  createdBy: 'u1', createdAt: new Date(), updatedAt: new Date(),
  municipalityId: 'm1', villageName: 'X', villageCoverImage: null,
  villageCoordinates: null, confirmedCount: 0, totalCount: 0,
  commentCount: 0, reactionCounts: { like: 0, heart: 0 }, endBoundary: new Date(),
};

describe('event status + registration check-in', () => {
  it('rejects the dropped draft status', () => {
    expect(() => EventDataSchema.parse({ ...baseEvent, status: 'draft' })).toThrow();
  });

  it('valid statuses pass through', () => {
    expect(EventDataSchema.parse({ ...baseEvent, status: 'cancelled' }).status).toBe('cancelled');
    expect(EventDataSchema.parse({ ...baseEvent, status: 'completed' }).status).toBe('completed');
  });

  it('buildRegistrationData defaults checkedInAt to null and isMember to false', () => {
    const built = buildRegistrationData({ userId: 'u', personId: 'p', name: 'N', status: 'confirmed', position: 1 });
    expect(built.checkedInAt).toBeNull();
    expect(built.isMember).toBe(false);
  });

  it('requires isMember and checkedInAt on the persisted shape', () => {
    expect(() =>
      RegistrationDataSchema.parse({
        userId: 'u', personId: 'p', name: 'N', status: 'confirmed', position: 1, registeredAt: new Date(),
      }),
    ).toThrow();
  });
});
