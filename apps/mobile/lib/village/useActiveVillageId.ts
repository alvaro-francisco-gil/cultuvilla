import { useAuth } from '../auth/useAuth';
import { useGuestActiveVillage } from './GuestActiveVillageContext';

/**
 * The active village for the current viewer, unified across auth states: a
 * signed-in user's profile.activeMunicipalityId, falling back to the village a
 * logged-out visitor opened via a share link. Kept pure below so the
 * precedence (profile wins) is unit-testable without mounting the providers.
 */
export function resolveActiveVillageId(
  profileActiveId: string | null,
  guestVillageId: string | null,
): string | null {
  return profileActiveId ?? guestVillageId;
}

export function useActiveVillageId(): string | null {
  const { profile } = useAuth();
  const { guestVillageId } = useGuestActiveVillage();
  return resolveActiveVillageId(profile?.activeMunicipalityId ?? null, guestVillageId);
}
