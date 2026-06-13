import { describe, it, expect } from 'vitest';
import { Timestamp, GeoPoint } from 'firebase/firestore';
import { eventConverterClient } from '../../../src/firebase/converters/eventConverter.client';

const baseFirestoreShape = {
  title: 'Fiesta',
  description: 'Annual fiesta',
  startDate: Timestamp.fromDate(new Date('2026-06-15T18:00:00Z')),
  endDate: null,
  location: { type: 'text', coordinates: null, text: 'Plaza' },
  imageURL: null,
  maxAttendees: 100,
  telephoneRequired: false,
  status: 'published',
  organizationId: 'org-1',
  organizationName: 'Asociación X',
  createdBy: 'user-1',
  createdAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
  updatedAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
  municipalityId: 'm-1',
  municipalityName: 'Villa',
  municipalityCoverImage: null,
  municipalityCoordinates: new GeoPoint(40.4, -3.7),
};

describe('eventConverterClient', () => {
  it('fromFirestore returns typed EventData with Date and {lat,lng}', () => {
    const snap = { data: () => baseFirestoreShape };
    const event = eventConverterClient.fromFirestore(snap);
    expect(event.startDate).toBeInstanceOf(Date);
    expect(event.municipalityCoordinates).toEqual({ lat: 40.4, lng: -3.7 });
    expect(event.status).toBe('published');
  });

  it('toFirestore returns Firestore-shaped data with Date passed through and GeoPoint', () => {
    const event = eventConverterClient.fromFirestore({ data: () => baseFirestoreShape });
    const out = eventConverterClient.toFirestore(event);
    // Date is passed through unchanged; the SDK converts it to a Timestamp on write.
    expect(out.startDate).toBeInstanceOf(Date);
    expect(out.municipalityCoordinates).toBeInstanceOf(GeoPoint);
  });

  it('fromFirestore throws when a required field is missing', () => {
    const { title: _title, ...rest } = baseFirestoreShape;
    void _title;
    expect(() => eventConverterClient.fromFirestore({ data: () => rest })).toThrow();
  });
});
