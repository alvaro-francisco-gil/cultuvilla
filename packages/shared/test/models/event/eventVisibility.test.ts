import { describe, it, expect } from 'vitest';
import {
  EventDataSchema,
  buildEventData,
  canViewEvent,
  isPrivateEvent,
  type EventDataInput,
} from '../../../src/models/event/EventDataModel';

const base: EventDataInput = {
  title: 'Cena de la peña',
  description: 'Solo para socios',
  startDate: new Date('2026-08-01T20:00:00Z'),
  location: { coordinates: { lat: 40, lng: -3 }, displayName: 'Local' },
  organizerUserIds: ['u1'],
  organizerOrgIds: ['org1'],
  createdBy: 'u1',
  municipalityId: 'm1',
  villageName: 'Villa',
  villageCoordinates: null,
};

describe('event visibility — build', () => {
  it('defaults to a public event with no org', () => {
    const e = buildEventData(base);
    expect(e.visibility).toBe('public');
    expect(e.visibilityOrgId).toBeNull();
    expect(isPrivateEvent(e)).toBe(false);
  });

  it('stores the org when the event is private', () => {
    const e = buildEventData({ ...base, visibility: 'organization', visibilityOrgId: 'org1' });
    expect(e.visibility).toBe('organization');
    expect(e.visibilityOrgId).toBe('org1');
    expect(isPrivateEvent(e)).toBe(true);
  });

  it('a private event without an org falls back to public rather than being unreadable', () => {
    const e = buildEventData({ ...base, visibility: 'organization', visibilityOrgId: null });
    expect(e.visibility).toBe('public');
    expect(e.visibilityOrgId).toBeNull();
  });

  it('drops an orphan org id from a public event', () => {
    const e = buildEventData({ ...base, visibility: 'public', visibilityOrgId: 'org1' });
    expect(e.visibilityOrgId).toBeNull();
  });
});

describe('event visibility — legacy docs', () => {
  it('parses a stored doc written before the fields existed as public', () => {
    const stored = { ...buildEventData(base) } as Record<string, unknown>;
    delete stored['visibility'];
    delete stored['visibilityOrgId'];
    const parsed = EventDataSchema.parse(stored);
    expect(parsed.visibility).toBe('public');
    expect(parsed.visibilityOrgId).toBeNull();
  });
});

describe('canViewEvent', () => {
  const publicEvent = buildEventData(base);
  const privateEvent = buildEventData({
    ...base,
    visibility: 'organization',
    visibilityOrgId: 'org1',
  });

  it('lets anyone — signed out included — see a public event', () => {
    expect(canViewEvent(publicEvent, { userId: null, orgIds: [] })).toBe(true);
  });

  it('hides a private event from a signed-out visitor', () => {
    expect(canViewEvent(privateEvent, { userId: null, orgIds: [] })).toBe(false);
  });

  it('hides a private event from a member of a different org', () => {
    expect(canViewEvent(privateEvent, { userId: 'u9', orgIds: ['org2'] })).toBe(false);
  });

  it('shows a private event to a member of its org', () => {
    expect(canViewEvent(privateEvent, { userId: 'u9', orgIds: ['org2', 'org1'] })).toBe(true);
  });

  it('shows a private event to its organizers even outside the org', () => {
    expect(canViewEvent(privateEvent, { userId: 'u1', orgIds: [] })).toBe(true);
  });

  it('shows a private event to an app admin', () => {
    expect(canViewEvent(privateEvent, { userId: 'root', orgIds: [], isAppAdmin: true })).toBe(true);
  });
});
