import { useEffect, useState } from 'react';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
import type { VisibilityStatus } from '@cultuvilla/shared/models';
import { useAuth } from './useAuth';
import { useIsAppAdmin } from './useIsAppAdmin';

/**
 * Role-driven capabilities for village-scoped entity surfaces. "Organizer" =
 * village admin or app admin: they can manage optimistic content directly and
 * approve/reject approval-gated organization requests.
 *
 * `canEdit` / `canDelete` add the second axis the Firestore rules already carry:
 * whoever created a doc may maintain it. Keep them in step with the `allow
 * update` / `allow delete` clauses on places, barrios and festivalPosters.
 */
export interface EntityCapabilities {
  /** Commit directly / edit live items (organizer). */
  canManage: boolean;
  /** Approve or reject pending org requests (same axis as canManage). */
  canApprove: boolean;
  /** Admin, or the doc's creator (`proposedBy` / `createdBy`). */
  canEdit: (creatorId: string | null | undefined) => boolean;
  /**
   * Admin, or the creator of a doc that is still `active` — once moderation has
   * hidden it, withdrawing it would undo the moderation, so only admins can.
   */
  canDelete: (creatorId: string | null | undefined, status: VisibilityStatus) => boolean;
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
  const uid = user?.uid ?? null;
  const isCreator = (creatorId: string | null | undefined) => uid != null && creatorId === uid;

  return {
    canManage,
    canApprove: canManage,
    canEdit: (creatorId) => canManage || isCreator(creatorId),
    canDelete: (creatorId, status) => canManage || (isCreator(creatorId) && status === 'active'),
    uid,
    loading,
  };
}
