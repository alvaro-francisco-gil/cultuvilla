import { router } from 'expo-router';
import { getVillageSlug } from '@cultuvilla/shared/services/municipalityService';
import { villageHref } from './routes';

/**
 * Opens a pueblo known only by its municipality id — an inbox row, a
 * just-started village. Its URL is its slug, which the id alone doesn't carry;
 * the lookup is cached for the session, so a village already on screen costs
 * nothing.
 */
export async function openVillage(municipalityId: string, mode: 'push' | 'replace' = 'push'): Promise<void> {
  const href = villageHref(await getVillageSlug(municipalityId));
  if (mode === 'replace') router.replace(href);
  else router.push(href);
}
