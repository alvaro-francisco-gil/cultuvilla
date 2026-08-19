import { useEffect, useState } from 'react';
import { getVillageMemberRole } from '@cultuvilla/shared/services/villageMemberService';
import type { VillageMemberRole, VisibilityStatus } from '@cultuvilla/shared/models';
import { useAuth } from './useAuth';
import { useIsAppAdmin } from './useIsAppAdmin';

/**
 * Role-driven capabilities for village-scoped entity surfaces. "Organizer" =
 * village admin or app admin: they can manage optimistic content directly and
 * approve/reject approval-gated organization requests.
 *
 * `canEdit` / `canDelete` add the identity axis the Firestore rules carry: an
 * entity is maintained by an admin, by whoever created it, or by anyone named
 * in its organizer set. This is the ONE definition of "may I edit this?" for
 * every entity kind — event, news, place, barrio, cartel. Keep it in step with
 * the `allow update` / `allow delete` clauses those collections declare.
 */
export interface EntityCapabilities {
  /** Commit directly / edit live items (organizer). */
  canManage: boolean;
  /** Approve or reject pending org requests (same axis as canManage). */
  canApprove: boolean;
  /**
   * Admin, the doc's creator (`proposedBy` / `createdBy`), or a user named in
   * `organizerUserIds` — pass that set for the kinds that have one.
   */
  canEdit: (creatorId: string | null | undefined, organizerUserIds?: readonly string[]) => boolean;
  /**
   * Admin, or the creator of a doc that is still `active` — once moderation has
   * hidden it, withdrawing it would undo the moderation, so only admins can.
   */
  canDelete: (creatorId: string | null | undefined, status: VisibilityStatus) => boolean;
  /**
   * Joined the entity's pueblo (any role). Village-scoped reads that are open
   * to residents but not to the open web — the event attendee roster — gate on
   * this, matching the `isVillageMember` clause the Firestore rules use.
   */
  isMember: boolean;
  /** Current user's uid, for own-pending checks. `null` when signed out. */
  uid: string | null;
  loading: boolean;
}

export function useEntityCapabilities(municipalityId: string | undefined): EntityCapabilities {
  const { user, loading: authLoading } = useAuth();
  const { isAppAdmin, loading: appAdminLoading } = useIsAppAdmin();
  // One read answers both "is a member" and "is an admin" — `undefined` while
  // in flight, `null` once resolved to "not a member".
  const [role, setRole] = useState<VillageMemberRole | null | undefined>(undefined);

  useEffect(() => {
    if (!user || !municipalityId) {
      setRole(null);
      return;
    }
    let cancelled = false;
    setRole(undefined);
    getVillageMemberRole(municipalityId, user.uid).then((r) => {
      if (!cancelled) setRole(r);
    });
    return () => {
      cancelled = true;
    };
  }, [user, municipalityId]);

  const loading = authLoading || appAdminLoading || role === undefined;
  const canManage = isAppAdmin || role === 'admin';
  const uid = user?.uid ?? null;
  const isCreator = (creatorId: string | null | undefined) => uid != null && creatorId === uid;
  const isOrganizer = (organizerUserIds?: readonly string[]) =>
    uid != null && organizerUserIds != null && organizerUserIds.includes(uid);

  return {
    canManage,
    canApprove: canManage,
    canEdit: (creatorId, organizerUserIds) =>
      canManage || isCreator(creatorId) || isOrganizer(organizerUserIds),
    canDelete: (creatorId, status) => canManage || (isCreator(creatorId) && status === 'active'),
    // App admins act everywhere, so they count as members of every pueblo for
    // read purposes — the same equivalence canManage already makes.
    isMember: isAppAdmin || role != null,
    uid,
    loading,
  };
}
