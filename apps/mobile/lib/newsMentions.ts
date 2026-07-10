import type { NewsMention } from '@cultuvilla/shared/models/news/NewsPostDataModel';

/**
 * Resolve an `@`-mention to an in-app route, or `null` when the entity type has
 * no standalone screen. `municipalityId` is needed for place links, which are
 * nested under their village.
 *
 * - organization   → `/o/{id}`
 * - event          → `/event/{id}`
 * - place          → `/village/{municipalityId}/place/{id}`
 * - barrio         → `/village/{municipalityId}/barrio/{id}`
 * - festivalPoster → `/village/{municipalityId}/festival-poster/{id}`
 * - village        → `/village/{id}`
 * - news           → `/news/{id}`
 */
export function mentionHref(mention: NewsMention, municipalityId: string): string | null {
  switch (mention.entityType) {
    case 'organization':
      return `/o/${mention.entityId}`;
    case 'event':
      return `/event/${mention.entityId}`;
    case 'place':
      return `/village/${municipalityId}/place/${mention.entityId}`;
    case 'barrio':
      return `/village/${municipalityId}/barrio/${mention.entityId}`;
    case 'festivalPoster':
      return `/village/${municipalityId}/festival-poster/${mention.entityId}`;
    case 'village':
      return `/village/${mention.entityId}`;
    case 'news':
      return `/news/${mention.entityId}`;
    default:
      return null;
  }
}
