import { describe, it, expect } from 'vitest';
import { Timestamp, GeoPoint } from 'firebase/firestore';
import { eventConverterClient } from '../../../src/firebase/converters/eventConverter.client';

const baseFirestoreShape = {
  title: 'Fiesta',
  description: 'Annual fiesta',
  startDate: Timestamp.fromDate(new Date('2026-06-15T18:00:00Z')),
  endDate: Timestamp.fromDate(new Date('2026-06-17T18:00:00Z')),
  location: { coordinates: new GeoPoint(40.4, -3.7), displayName: 'Plaza Mayor' },
  imageURL: null,
  maxAttendees: 100,
  telephoneRequired: false,
  status: 'published',
  organizerUserIds: ['user-1'],
  organizerOrgIds: ['org-1'],
  createdBy: 'user-1',
  createdAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
  updatedAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
  municipalityId: 'm-1',
  villageName: 'Villa',
  villageCoverImage: null,
  villageCoordinates: new GeoPoint(40.4, -3.7),
  confirmedCount: 0,
  totalCount: 0,
  endBoundary: Timestamp.fromDate(new Date('2026-06-17T18:00:00Z')),
};

describe('eventConverterClient', () => {
  it('fromFirestore returns typed EventData with Date and {lat,lng}', () => {
    const snap = { data: () => baseFirestoreShape };
    const event = eventConverterClient.fromFirestore(snap);
    expect(event.startDate).toBeInstanceOf(Date);
    expect(event.endDate).toBeInstanceOf(Date);
    expect(event.villageCoordinates).toEqual({ lat: 40.4, lng: -3.7 });
    expect(event.status).toBe('published');
  });

  it('fromFirestore converts nested location GeoPoint to {lat,lng}', () => {
    const snap = { data: () => baseFirestoreShape };
    const event = eventConverterClient.fromFirestore(snap);
    expect(event.location.coordinates).toEqual({ lat: 40.4, lng: -3.7 });
    expect(event.location.displayName).toBe('Plaza Mayor');
  });

  it('fromFirestore returns organizerUserIds and organizerOrgIds arrays', () => {
    const snap = { data: () => baseFirestoreShape };
    const event = eventConverterClient.fromFirestore(snap);
    expect(event.organizerUserIds).toEqual(['user-1']);
    expect(event.organizerOrgIds).toEqual(['org-1']);
  });

  it('toFirestore returns Firestore-shaped data with Date passed through and GeoPoint', () => {
    const event = eventConverterClient.fromFirestore({ data: () => baseFirestoreShape });
    const out = eventConverterClient.toFirestore(event);
    // Date is passed through unchanged; the SDK converts it to a Timestamp on write.
    expect(out.startDate).toBeInstanceOf(Date);
    expect(out.villageCoordinates).toBeInstanceOf(GeoPoint);
  });

  it('fromFirestore throws when a required field is missing', () => {
    const { title: _title, ...rest } = baseFirestoreShape;
    void _title;
    expect(() => eventConverterClient.fromFirestore({ data: () => rest })).toThrow();
  });
});
