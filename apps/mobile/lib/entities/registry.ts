import { Ionicons } from '@expo/vector-icons';

/** The village-scoped objects that render as a scroll card and open a
 * hero-image detail screen. See the "Entities" convention in AGENTS.md. */
export type EntityKind =
  | 'event'
  | 'festivalPoster'
  | 'place'
  | 'barrio'
  | 'organization'
  | 'news';

/** Fallback Ionicon shown in DetailHeroImage / cards when an entity has no
 * image. Single source of truth for the icons the detail screens used to
 * hardcode. */
export const ENTITY_FALLBACK_ICON: Record<EntityKind, keyof typeof Ionicons.glyphMap> = {
  event: 'calendar-outline',
  festivalPoster: 'image-outline',
  place: 'location-outline',
  barrio: 'map-outline',
  organization: 'people-outline',
  news: 'newspaper-outline',
};
