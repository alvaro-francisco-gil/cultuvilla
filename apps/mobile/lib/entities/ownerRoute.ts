import { router } from 'expo-router';
import { getOrganization } from '@cultuvilla/shared/services/organizationService';
import type { OwnerType } from '../useOwnerSummary';
import { orgHref, personHref, userHref } from '../navigation/routes';

/**
 * Opens a credited owner reference — event organizers, contributor chips, news
 * bylines — so the same chip leads to the same place from every screen.
 *
 * An organization's URL carries its pueblo and its name (`/matabuena/entidad/
 * pena-el-roble_o1`), neither of which a bare id knows, so that one branch
 * resolves the doc first. Firestore serves it from cache after the chip's own
 * live subscription has loaded it, so the extra read is normally free.
 *
 * `person` has no owner surface of its own here: a persona is opened through
 * `/persona/{id}` by the roster screens that know whether the viewer may read
 * it, so callers that render personas pass their own handler.
 */
export async function openOwner(ownerType: OwnerType, ownerId: string): Promise<void> {
  switch (ownerType) {
    case 'person':
      router.push(personHref(ownerId));
      return;
    case 'user':
      router.push(userHref(ownerId));
      return;
    case 'organization': {
      const org = await getOrganization(ownerId);
      if (!org) return;
      router.push(orgHref({ id: org.id, name: org.name, villageSlug: org.villageSlug }));
    }
  }
}
