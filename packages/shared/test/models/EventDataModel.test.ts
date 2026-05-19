import { describe, it, expect } from 'vitest';
import { GeoPoint } from 'firebase/firestore';
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
      municipalityId: 'v1',
      municipalityName: 'Test Village',
      municipalityCoordinates: new GeoPoint(0, 0),
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
      municipalityId: 'v1',
      municipalityName: 'Test Village',
      municipalityCoordinates: new GeoPoint(0, 0),
    });
    expect(event.maxAttendees).toBe(50);
    expect(event.telephoneRequired).toBe(true);
    expect(event.price).toBe(15);
  });
});

describe('EventDataModel — municipality denormalization', () => {
  it('stores municipalityId, name, cover image, and coordinates', () => {
    const coords = new GeoPoint(40.5, -4.0);
    const event = buildEventData({
      title: 't',
      description: 'd',
      startDate: new Date('2026-05-01'),
      location: { type: 'text', coordinates: null, text: 'plaza' },
      organizationId: 'org1',
      organizationName: 'Org 1',
      createdBy: 'u1',
      municipalityId: 'v1',
      municipalityName: 'Becerril',
      municipalityCoverImage: 'https://example/cover.jpg',
      municipalityCoordinates: coords,
    });
    expect(event.municipalityId).toBe('v1');
    expect(event.municipalityName).toBe('Becerril');
    expect(event.municipalityCoverImage).toBe('https://example/cover.jpg');
    expect(event.municipalityCoordinates).toBe(coords);
  });

  it('allows municipalityCoverImage to be null', () => {
    const event = buildEventData({
      title: 't',
      description: 'd',
      startDate: new Date('2026-05-01'),
      location: { type: 'text', coordinates: null, text: 'plaza' },
      organizationId: 'org1',
      organizationName: 'Org 1',
      createdBy: 'u1',
      municipalityId: 'v1',
      municipalityName: 'Becerril',
      municipalityCoverImage: null,
      municipalityCoordinates: new GeoPoint(0, 0),
    });
    expect(event.municipalityCoverImage).toBeNull();
  });

  it('defaults municipalityCoverImage to null when omitted', () => {
    const event = buildEventData({
      title: 't',
      description: 'd',
      startDate: new Date('2026-05-01'),
      location: { type: 'text', coordinates: null, text: 'plaza' },
      organizationId: 'org1',
      organizationName: 'Org 1',
      createdBy: 'u1',
      municipalityId: 'v1',
      municipalityName: 'Becerril',
      municipalityCoordinates: new GeoPoint(0, 0),
    });
    expect(event.municipalityCoverImage).toBeNull();
  });
});
