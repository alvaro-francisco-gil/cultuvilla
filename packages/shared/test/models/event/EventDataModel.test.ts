import { describe, it, expect } from 'vitest';
import {
  EventDataSchema,
  buildEventData,
  isEventFull,
  isEventSignupOpen,
  isEventOngoing,
  isStartDayOver,
} from '../../../src/models/event/EventDataModel';

const validEvent = {
  title: 'Fiesta',
  description: 'Annual fiesta',
  startDate: new Date('2026-06-15T18:00:00Z'),
  location: { coordinates: { lat: 40.4, lng: -3.7 }, displayName: 'Plaza Mayor' },
  imageURL: null,
  maxAttendees: 100,
  telephoneRequired: false,
  status: 'published' as const,
  organizerUserIds: ['u'],
  organizerOrgIds: [],
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  municipalityId: 'm-1',
  municipalityName: 'Villa',
  municipalityCoverImage: null,
  municipalityCoordinates: { lat: 40.4, lng: -3.7 },
  confirmedCount: 0,
  totalCount: 0,
};

describe('EventDataSchema', () => {
  it('parses a complete valid event', () => {
    expect(() => EventDataSchema.parse(validEvent)).not.toThrow();
  });

  it('requires confirmedCount and totalCount', () => {
    const { confirmedCount: _c, totalCount: _t, ...rest } = validEvent;
    expect(() => EventDataSchema.parse(rest)).toThrow();
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
      location: { coordinates: { lat: 1, lng: 2 }, displayName: 'Plaza' },
      organizerUserIds: ['u'],
      organizerOrgIds: [],
      createdBy: 'u',
      municipalityId: 'm', municipalityName: 'M',
      municipalityCoordinates: { lat: 1, lng: 2 },
    });
    expect(built.status).toBe('published');
    expect(built.telephoneRequired).toBe(false);
    expect(() => EventDataSchema.parse(built)).not.toThrow();
  });
});

describe('isEventFull', () => {
  const base = EventDataSchema.parse({
    title: 'X', description: 'Y',
    startDate: new Date('2026-06-15T18:00:00Z'),
    location: { coordinates: { lat: 1, lng: 2 }, displayName: 'Plaza' },
    imageURL: null, maxAttendees: null,
    telephoneRequired: false, status: 'published',
    organizerUserIds: ['u'], organizerOrgIds: [], createdBy: 'u',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    municipalityId: 'm', municipalityName: 'M',
    municipalityCoverImage: null,
    municipalityCoordinates: { lat: 1, lng: 2 },
    confirmedCount: 0, totalCount: 0,
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
    startDate: new Date('2026-06-15T18:00:00Z'),
    location: { coordinates: { lat: 1, lng: 2 }, displayName: 'Plaza' },
    imageURL: null, maxAttendees: null,
    telephoneRequired: false, status: 'published',
    organizerUserIds: ['u'], organizerOrgIds: [], createdBy: 'u',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    municipalityId: 'm', municipalityName: 'M',
    municipalityCoverImage: null,
    municipalityCoordinates: { lat: 1, lng: 2 },
    confirmedCount: 0, totalCount: 0,
  });

  it('returns true only for status published', () => {
    expect(isEventSignupOpen({ ...base, status: 'published' })).toBe(true);
    expect(isEventSignupOpen({ ...base, status: 'cancelled' })).toBe(false);
    expect(isEventSignupOpen({ ...base, status: 'completed' })).toBe(false);
  });
});

describe('isEventOngoing', () => {
  const now = new Date('2026-06-15T21:00:00Z'); // 23:00 Madrid, still the 15th
  it('true: published, started earlier same Madrid day', () => {
    expect(isEventOngoing({ status: 'published', startDate: new Date('2026-06-15T16:00:00Z') }, now)).toBe(true);
  });
  it('false: before start', () => {
    expect(isEventOngoing({ status: 'published', startDate: new Date('2026-06-15T22:00:00Z') }, now)).toBe(false);
  });
  it('false: Madrid start-day is over', () => {
    expect(isEventOngoing({ status: 'published', startDate: new Date('2026-06-14T16:00:00Z') }, now)).toBe(false);
  });
  it('false: not published', () => {
    expect(isEventOngoing({ status: 'cancelled', startDate: new Date('2026-06-15T16:00:00Z') }, now)).toBe(false);
  });
});

describe('isStartDayOver', () => {
  it('false later same Madrid day', () => {
    expect(isStartDayOver(new Date('2026-06-15T08:00:00Z'), new Date('2026-06-15T21:00:00Z'))).toBe(false);
  });
  it('true next Madrid day', () => {
    expect(isStartDayOver(new Date('2026-06-15T08:00:00Z'), new Date('2026-06-15T23:30:00Z'))).toBe(true);
  });
});
