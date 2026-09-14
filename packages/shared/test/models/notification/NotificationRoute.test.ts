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
    expect(notificationRoute({ ...base, type: 'event_cancelled', eventId: 'ev1' }, 'villa')).toBe(
      '/villa/evento/_ev1',
    );
  });

  // The notification holds the entity's id, not its current title, so the ref
  // carries no title slug — the screen reads only the id.
  it.each([
    ['event', '/villa/evento/_x'],
    ['news', '/villa/noticia/_x'],
    ['organization', '/villa/entidad/_x'],
    ['place', '/villa/lugar/_x'],
    ['barrio', '/villa/barrio/_x'],
    ['festivalPoster', '/villa/cartel/_x'],
    ['historyEntry', '/villa/acontecimiento/_x'],
  ] as const)('routes a %s entity to %s', (entityKind, route) => {
    expect(notificationRoute({ ...base, entityKind, entityId: 'x' }, 'villa')).toBe(route);
  });

  it('opens a word by the slug half of its term id', () => {
    expect(
      notificationRoute({ ...base, entityKind: 'vocabularyTerm', entityId: 'mun1__esbardo' }, 'villa'),
    ).toBe('/villa/palabra/esbardo');
  });

  it('cannot address anything without the pueblo slug', () => {
    expect(notificationRoute({ ...base, type: 'event_cancelled', eventId: 'ev1' }, null)).toBeNull();
    expect(notificationRoute({ ...base, entityKind: 'place', entityId: 'x' }, null)).toBeNull();
  });

  it('sends organization outcomes to the village’s organizations list', () => {
    expect(notificationRoute({ ...base, type: 'org_approved' }, 'villa')).toBe('/villa/entidades');
    expect(notificationRoute({ ...base, type: 'org_rejected' }, 'villa')).toBe('/villa/entidades');
  });

  it('sends the Wrapped reminder to the create screen', () => {
    expect(notificationRoute({ ...base, type: 'village_wrapped_reminder' }, 'villa')).toBe('/villa/resumen');
  });

  it('sends organizer outcomes to the village', () => {
    expect(notificationRoute({ ...base, type: 'organizer_request_approved' }, 'villa')).toBe('/villa');
  });

  it('returns null when there is nothing to open, so callers fall back to the Buzón', () => {
    expect(notificationRoute({ ...base, type: 'comment_reply' }, 'villa')).toBeNull();
  });
});
