import type { NotificationData } from './NotificationDataModel';

/**
 * Where tapping a notification should land, as an Expo Router path.
 *
 * Pure and shared on purpose: the SAME function resolves the destination for a
 * row tapped inside the Buzón and for a push tapped on the lock screen. Two
 * implementations would drift, and the one nobody can see in the simulator —
 * the push path — is the one that would rot.
 *
 * Returns null when the notification refers to nothing openable (a rejected
 * request has no screen of its own); callers fall back to the Buzón.
 */
export type NotificationRouteInput = Pick<
  NotificationData,
  'type' | 'eventId' | 'entityKind' | 'entityId' | 'municipalityId'
>;

export function notificationRoute(n: NotificationRouteInput): string | null {
  // An event id is the most specific thing a notification can carry, and every
  // type that sets one is about that event.
  if (n.eventId) return `/event/${n.eventId}`;

  if (n.entityId && n.entityKind) {
    switch (n.entityKind) {
      case 'event':
        return `/event/${n.entityId}`;
      case 'news':
        return `/news/${n.entityId}`;
      case 'organization':
        return `/o/${n.entityId}`;
      // Village-nested entities cannot be addressed without their village.
      case 'place':
        return n.municipalityId ? `/village/${n.municipalityId}/place/${n.entityId}` : null;
      case 'barrio':
        return n.municipalityId ? `/village/${n.municipalityId}/barrio/${n.entityId}` : null;
      case 'festivalPoster':
        return n.municipalityId
          ? `/village/${n.municipalityId}/festival-poster/${n.entityId}`
          : null;
      case 'vocabularyTerm':
        return n.municipalityId ? `/village/${n.municipalityId}/word/${n.entityId}` : null;
    }
  }

  if (n.type === 'org_approved' || n.type === 'org_rejected') {
    return n.municipalityId ? `/village/${n.municipalityId}/organizations` : null;
  }
  if (
    n.type === 'organizer_request_approved' ||
    n.type === 'organizer_request_rejected'
  ) {
    return n.municipalityId ? `/village/${n.municipalityId}` : null;
  }

  return null;
}
