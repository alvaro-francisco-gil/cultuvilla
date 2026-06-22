import { useEffect, useState } from 'react';
import { isOrgMember } from '@cultuvilla/shared/services/orgMemberService';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
import { useAuth } from '../auth/useAuth';
import { useIsAppAdmin } from '../auth/useIsAppAdmin';

/**
 * Can the current user organize THIS event? Organizer = member of the event's
 * owning organization, OR a village admin of the event's municipality, OR an
 * app admin (matches the event update/delete firestore rules).
 */
export function useEventOrganizer(
  event: { organizationId: string; municipalityId: string } | null,
): { canOrganize: boolean; loading: boolean } {
  const { user } = useAuth();
  const { isAppAdmin, loading: appAdminLoading } = useIsAppAdmin();
  const [orgOrVillage, setOrgOrVillage] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || !event) {
      setOrgOrVillage(false);
      return;
    }
    let cancelled = false;
    setOrgOrVillage(null);
    Promise.all([
      isOrgMember(event.organizationId, user.uid),
      isVillageAdmin(event.municipalityId, user.uid),
    ]).then(([om, va]) => {
      if (!cancelled) setOrgOrVillage(om || va);
    });
    return () => {
      cancelled = true;
    };
  }, [user, event?.organizationId, event?.municipalityId]);

  const loading = appAdminLoading || orgOrVillage === null;
  return { canOrganize: isAppAdmin || orgOrVillage === true, loading };
}
