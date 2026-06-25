import { useEffect, useState } from 'react';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
import { useAuth } from '../auth/useAuth';
import { useIsAppAdmin } from '../auth/useIsAppAdmin';

/**
 * Can the current user organize THIS event? Organizer = a named user in
 * `organizerUserIds`, a village admin of the event's municipality, or an app
 * admin. Mirrors the event update/delete Firestore rules (`uid in
 * organizerUserIds || villageAdmin || appAdmin`). No org-membership check.
 */
export function useEventOrganizer(
  event: { organizerUserIds: string[]; municipalityId: string } | null,
): { canOrganize: boolean; loading: boolean } {
  const { user } = useAuth();
  const { isAppAdmin, loading: appAdminLoading } = useIsAppAdmin();
  const [villageAdmin, setVillageAdmin] = useState<boolean | null>(null);

  const isOrganizer = !!user && !!event && event.organizerUserIds.includes(user.uid);

  useEffect(() => {
    if (!user || !event) {
      setVillageAdmin(false);
      return;
    }
    let cancelled = false;
    setVillageAdmin(null);
    isVillageAdmin(event.municipalityId, user.uid).then((va) => {
      if (!cancelled) setVillageAdmin(va);
    });
    return () => {
      cancelled = true;
    };
  }, [user, event?.municipalityId]);

  const loading = appAdminLoading || villageAdmin === null;
  return { canOrganize: isAppAdmin || isOrganizer || villageAdmin === true, loading };
}
