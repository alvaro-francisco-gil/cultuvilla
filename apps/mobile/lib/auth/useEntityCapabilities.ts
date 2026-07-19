import { useEffect, useState } from 'react';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
import { useAuth } from './useAuth';
import { useIsAppAdmin } from './useIsAppAdmin';

/**
 * Role-driven capabilities for village-scoped entity surfaces. "Organizer" =
 * village admin or app admin: they can manage optimistic content directly and
 * approve/reject approval-gated organization requests.
 */
export interface EntityCapabilities {
  /** Commit directly / edit live items (organizer). */
  canManage: boolean;
  /** Approve or reject pending org requests (same axis as canManage). */
  canApprove: boolean;
  /** Current user's uid, for own-pending checks. `null` when signed out. */
  uid: string | null;
  loading: boolean;
}

export function useEntityCapabilities(municipalityId: string | undefined): EntityCapabilities {
  const { user, loading: authLoading } = useAuth();
  const { isAppAdmin, loading: appAdminLoading } = useIsAppAdmin();
  const [villageAdmin, setVillageAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || !municipalityId) {
      setVillageAdmin(false);
      return;
    }
    let cancelled = false;
    setVillageAdmin(null);
    isVillageAdmin(municipalityId, user.uid).then((ok) => {
      if (!cancelled) setVillageAdmin(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [user, municipalityId]);

  const loading = authLoading || appAdminLoading || villageAdmin === null;
  const canManage = isAppAdmin || villageAdmin === true;
  return { canManage, canApprove: canManage, uid: user?.uid ?? null, loading };
}
