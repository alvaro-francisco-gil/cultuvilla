import { router } from 'expo-router';
import type { NewsMention } from '@cultuvilla/shared/models/news/NewsPostDataModel';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import {
  barrioHref,
  eventHref,
  festivalPosterHref,
  newsHref,
  orgHref,
  placeHref,
  villageHref,
} from './navigation/routes';

/**
 * Opens an `@`-mention. Every entity lives under its pueblo, and a mention
 * stores the entity's `label`, so the URL can be rebuilt from the mention alone
 * — except a mention of *another* village, whose slug only its own doc knows.
 * That one branch resolves it; nothing else costs a read.
 *
 * Entity types with no standalone screen do nothing.
 */
export async function openMention(mention: NewsMention, villageSlug: string): Promise<void> {
  const { entityId: id, label } = mention;
  switch (mention.entityType) {
    case 'organization':
      router.push(orgHref({ id, name: label, villageSlug }));
      return;
    case 'event':
      router.push(eventHref({ id, title: label, villageSlug }));
      return;
    case 'place':
      router.push(placeHref(villageSlug, { id, name: label }));
      return;
    case 'barrio':
      router.push(barrioHref(villageSlug, { id, name: label }));
      return;
    case 'festivalPoster':
      router.push(festivalPosterHref({ id, title: label, year: 0, villageSlug }));
      return;
    case 'news':
      router.push(newsHref({ id, title: label, villageSlug }));
      return;
    case 'village': {
      const mentioned = await getMunicipality(id);
      if (mentioned) router.push(villageHref(mentioned.slug));
    }
  }
}

/** Whether a mention leads anywhere — the ones that do get link styling. */
export function mentionIsNavigable(mention: NewsMention): boolean {
  return ['organization', 'event', 'place', 'barrio', 'festivalPoster', 'news', 'village'].includes(
    mention.entityType,
  );
}
