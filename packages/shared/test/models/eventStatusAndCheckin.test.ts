import { describe, it, expect } from 'vitest';
import { EventDataSchema } from '../../src/models/event/EventDataModel';
import { RegistrationDataSchema, buildRegistrationData } from '../../src/models/event/RegistrationDataModel';

const baseEvent = {
  title: 'Fiesta', description: 'x', startDate: new Date(),
  location: { coordinates: { lat: 40.4, lng: -3.7 }, displayName: 'Plaza' }, imageURL: null, maxAttendees: null,
  telephoneRequired: false, organizerUserIds: ['u1'], organizerOrgIds: [],
  createdBy: 'u1', createdAt: new Date(), updatedAt: new Date(),
  municipalityId: 'm1', municipalityName: 'X', municipalityCoverImage: null,
  municipalityCoordinates: null,
};

describe('event status migration + registration check-in', () => {
  it('legacy draft events coerce to published on read', () => {
    const parsed = EventDataSchema.parse({ ...baseEvent, status: 'draft' });
    expect(parsed.status).toBe('published');
  });

  it('valid statuses pass through', () => {
    expect(EventDataSchema.parse({ ...baseEvent, status: 'cancelled' }).status).toBe('cancelled');
    expect(EventDataSchema.parse({ ...baseEvent, status: 'completed' }).status).toBe('completed');
  });

  it('registrations default checkedInAt to null and legacy docs parse', () => {
    const built = buildRegistrationData({ userId: 'u', personId: 'p', name: 'N', status: 'confirmed', position: 1 });
    expect(built.checkedInAt).toBeNull();
    const legacy = RegistrationDataSchema.parse({
      userId: 'u', personId: 'p', name: 'N', status: 'confirmed', position: 1, registeredAt: new Date(),
    });
    expect(legacy.checkedInAt).toBeNull();
  });
});
