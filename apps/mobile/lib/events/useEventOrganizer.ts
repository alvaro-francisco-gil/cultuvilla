import { useEffect, useState } from 'react';
import { isOrgMember } from '@cultuvilla/shared/services/orgMemberService';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
import { useAuth } from '../auth/useAuth';
import { useIsAppAdmin } from '../auth/useIsAppAdmin';

/**
 * Can the current user organize THIS event? Organizer = the event creator, a
 * member of the event's owning organization (if any), a village admin of the
 * event's municipality, or an app admin. Mirrors the event update/delete
 * firestore rules (which include the creator and, for org events, org members).
 */
export function useEventOrganizer(
  event: { organizationId: string | null; municipalityId: string; createdBy?: string } | null,
): { canOrganize: boolean; loading: boolean } {
  const { user } = useAuth();
  const { isAppAdmin, loading: appAdminLoading } = useIsAppAdmin();
  const [orgOrVillage, setOrgOrVillage] = useState<boolean | null>(null);

  const isCreator = !!user && !!event && event.createdBy === user.uid;

  useEffect(() => {
    if (!user || !event) {
      setOrgOrVillage(false);
      return;
    }
    let cancelled = false;
    setOrgOrVillage(null);
    const orgCheck = event.organizationId
      ? isOrgMember(event.organizationId, user.uid)
      : Promise.resolve(false);
    Promise.all([orgCheck, isVillageAdmin(event.municipalityId, user.uid)]).then(([om, va]) => {
      if (!cancelled) setOrgOrVillage(om || va);
    });
    return () => {
      cancelled = true;
    };
  }, [user, event?.organizationId, event?.municipalityId]);

  const loading = appAdminLoading || orgOrVillage === null;
  return { canOrganize: isAppAdmin || isCreator || orgOrVillage === true, loading };
}
