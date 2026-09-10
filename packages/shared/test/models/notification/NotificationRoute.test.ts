import { describe, it, expect } from 'vitest';
import { notificationRoute, type NotificationRouteInput } from '../../../src/models/notification/NotificationRoute';

const base: NotificationRouteInput = {
  type: 'village_entity_published',
  eventId: null,
  entityKind: null,
  entityId: null,
  municipalityId: 'mun1',
};

describe('notificationRoute', () => {
  it('opens the event for anything carrying an eventId', () => {
    expect(notificationRoute({ ...base, type: 'event_cancelled', eventId: 'ev1' })).toBe('/event/ev1');
  });

  it.each([
    ['event', '/event/x'],
    ['news', '/news/x'],
    ['organization', '/o/x'],
    ['place', '/village/mun1/place/x'],
    ['barrio', '/village/mun1/barrio/x'],
    ['festivalPoster', '/village/mun1/festival-poster/x'],
    ['vocabularyTerm', '/village/mun1/word/x'],
  ] as const)('routes a %s entity to %s', (entityKind, route) => {
    expect(notificationRoute({ ...base, entityKind, entityId: 'x' })).toBe(route);
  });

  it('cannot address a village-nested entity without its village', () => {
    for (const entityKind of ['place', 'barrio', 'festivalPoster', 'vocabularyTerm'] as const) {
      expect(
        notificationRoute({ ...base, entityKind, entityId: 'x', municipalityId: null }),
      ).toBeNull();
    }
  });

  it('sends organization outcomes to the village’s organizations list', () => {
    expect(notificationRoute({ ...base, type: 'org_approved' })).toBe('/village/mun1/organizations');
    expect(notificationRoute({ ...base, type: 'org_rejected' })).toBe('/village/mun1/organizations');
  });

  it('sends organizer outcomes to the village', () => {
    expect(notificationRoute({ ...base, type: 'organizer_request_approved' })).toBe('/village/mun1');
  });

  it('returns null when there is nothing to open, so callers fall back to the Buzón', () => {
    expect(notificationRoute({ ...base, type: 'comment_reply', municipalityId: null })).toBeNull();
  });
});
