import { router } from 'expo-router';
import { notificationRoute, type NotificationRouteInput } from '@cultuvilla/shared/models/notification';
import { getVillageSlug } from '@cultuvilla/shared/services/municipalityService';

/**
 * Whether a Buzón row leads anywhere. Answered without the slug: the slug only
 * decides the path's first segment, never whether there is a path at all.
 */
export function isOpenableNotification(n: NotificationRouteInput): boolean {
  return n.municipalityId != null && notificationRoute(n, 'pueblo') !== null;
}

/**
 * Opens what a Buzón row is about. The route is village-first, and the row
 * holds a municipality id rather than its slug; the lookup is cached for the
 * session, so a pueblo already seen costs nothing.
 */
export async function openNotification(n: NotificationRouteInput): Promise<void> {
  if (!n.municipalityId) return;
  const route = notificationRoute(n, await getVillageSlug(n.municipalityId));
  if (route) router.push(route as never);
}
