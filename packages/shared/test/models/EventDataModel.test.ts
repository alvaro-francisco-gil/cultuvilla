import { describe, it, expect } from 'vitest';
import { buildEventData } from '../../src/models/event/EventDataModel';

describe('buildEventData', () => {
  it('builds an event with required fields', () => {
    const event = buildEventData({
      title: 'Fiesta del pueblo',
      description: 'Gran fiesta anual',
      startDate: new Date('2026-08-15T20:00:00'),
      location: { type: 'text', coordinates: null, text: 'Plaza Mayor' },
      organizationId: 'org-1',
      organizationName: 'Ayuntamiento',
      createdBy: 'user-1',
    });
    expect(event.title).toBe('Fiesta del pueblo');
    expect(event.status).toBe('draft');
    expect(event.endDate).toBeNull();
    expect(event.imageURL).toBeNull();
    expect(event.price).toBeNull();
    expect(event.maxAttendees).toBeNull();
    expect(event.telephoneRequired).toBe(false);
  });

  it('builds an event with max attendees and telephone required', () => {
    const event = buildEventData({
      title: 'Cena solidaria',
      description: 'Cena para 50 personas',
      startDate: new Date('2026-09-01T21:00:00'),
      location: { type: 'text', coordinates: null, text: 'Casa de cultura' },
      organizationId: 'org-1',
      organizationName: 'Asociación vecinos',
      createdBy: 'user-2',
      maxAttendees: 50,
      telephoneRequired: true,
      price: 15,
    });
    expect(event.maxAttendees).toBe(50);
    expect(event.telephoneRequired).toBe(true);
    expect(event.price).toBe(15);
  });
});
