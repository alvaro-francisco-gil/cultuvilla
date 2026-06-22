import { describe, it, expect } from 'vitest';
import {
  EventDataSchema,
  buildEventData,
  isEventFull,
  isEventSignupOpen,
} from '../../../src/models/event/EventDataModel';

const validEvent = {
  title: 'Fiesta',
  description: 'Annual fiesta',
  startDate: new Date('2026-06-15T18:00:00Z'),
  endDate: null,
  location: { type: 'text' as const, coordinates: null, text: 'Plaza Mayor' },
  imageURL: null,
  maxAttendees: 100,
  telephoneRequired: false,
  status: 'published' as const,
  organizationId: 'org-1',
  organizationName: 'Asociación X',
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  municipalityId: 'm-1',
  municipalityName: 'Villa',
  municipalityCoverImage: null,
  municipalityCoordinates: { lat: 40.4, lng: -3.7 },
};

describe('EventDataSchema', () => {
  it('parses a complete valid event', () => {
    expect(() => EventDataSchema.parse(validEvent)).not.toThrow();
  });

  it('accepts optional confirmedCount and totalCount', () => {
    expect(() => EventDataSchema.parse({ ...validEvent, confirmedCount: 12, totalCount: 15 })).not.toThrow();
  });

  it('rejects a missing required field', () => {
    const { title: _title, ...rest } = validEvent;
    expect(() => EventDataSchema.parse(rest)).toThrow();
  });

  it('rejects an unknown status value', () => {
    expect(() => EventDataSchema.parse({ ...validEvent, status: 'archived' })).toThrow();
  });
});

describe('buildEventData', () => {
  it('fills defaults for optional fields', () => {
    const built = buildEventData({
      title: 'X', description: 'Y',
      startDate: new Date('2026-06-15T18:00:00Z'),
      location: { type: 'text', coordinates: null, text: null },
      organizationId: 'o', organizationName: 'O',
      createdBy: 'u',
      municipalityId: 'm', municipalityName: 'M',
      municipalityCoordinates: { lat: 1, lng: 2 },
    });
    expect(built.status).toBe('published');
    expect(built.telephoneRequired).toBe(false);
    expect(built.endDate).toBeNull();
    expect(() => EventDataSchema.parse(built)).not.toThrow();
  });
});

describe('isEventFull', () => {
  const base = EventDataSchema.parse({
    title: 'X', description: 'Y',
    startDate: new Date('2026-06-15T18:00:00Z'), endDate: null,
    location: { type: 'text', coordinates: null, text: null },
    imageURL: null, maxAttendees: null,
    telephoneRequired: false, status: 'published',
    organizationId: 'o', organizationName: 'O', createdBy: 'u',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    municipalityId: 'm', municipalityName: 'M',
    municipalityCoverImage: null,
    municipalityCoordinates: { lat: 1, lng: 2 },
  });

  it('returns false when maxAttendees is null', () => {
    expect(isEventFull(base, 999)).toBe(false);
  });

  it('returns true when confirmedCount reaches maxAttendees', () => {
    expect(isEventFull({ ...base, maxAttendees: 5 }, 5)).toBe(true);
  });

  it('returns false when confirmedCount is below maxAttendees', () => {
    expect(isEventFull({ ...base, maxAttendees: 5 }, 4)).toBe(false);
  });
});

describe('isEventSignupOpen', () => {
  const base = EventDataSchema.parse({
    title: 'X', description: 'Y',
    startDate: new Date('2026-06-15T18:00:00Z'), endDate: null,
    location: { type: 'text', coordinates: null, text: null },
    imageURL: null, maxAttendees: null,
    telephoneRequired: false, status: 'draft',
    organizationId: 'o', organizationName: 'O', createdBy: 'u',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    municipalityId: 'm', municipalityName: 'M',
    municipalityCoverImage: null,
    municipalityCoordinates: { lat: 1, lng: 2 },
  });

  it('returns true only for status published', () => {
    expect(isEventSignupOpen({ ...base, status: 'published' })).toBe(true);
    expect(isEventSignupOpen({ ...base, status: 'draft' })).toBe(false);
    expect(isEventSignupOpen({ ...base, status: 'cancelled' })).toBe(false);
    expect(isEventSignupOpen({ ...base, status: 'completed' })).toBe(false);
  });
});
