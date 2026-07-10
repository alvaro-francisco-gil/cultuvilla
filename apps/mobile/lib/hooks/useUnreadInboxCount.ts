import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { useApproverStatus } from '../auth/useApproverStatus';
import { getUnreadCount } from '@cultuvilla/shared/services/notificationService';
import { getPendingOrganizerRequests } from '@cultuvilla/shared/services/organizerRequestService';
import {
  getPendingOrganizations,
  getOrganizationsByMunicipality,
} from '@cultuvilla/shared/services/organizationService';
import {
  getAllPendingJoinRequests,
  getPendingJoinRequestsForOrgs,
} from '@cultuvilla/shared/services/organizationJoinRequestService';

export type UseUnreadInboxCountResult = {
  count: number;
  refresh: () => void;
};

/**
 * Badge count for the header bell: unread notifications plus pending-actionable
 * rows (organizer requests, org-creation requests, join requests) for whatever
 * role(s) this user approves for — mirrors the role-branching in
 * apps/mobile/app/inbox/index.tsx so the badge and the Buzón screen never
 * disagree about what counts as "actionable".
 */
export function useUnreadInboxCount(): UseUnreadInboxCountResult {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { loading: approverLoading, isSuperAdmin, adminVillageIds, adminOrgIds, canApprove } =
    useApproverStatus();
  const [count, setCount] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!uid) {
      setCount(0);
      return;
    }
    if (approverLoading) return;

    let cancelled = false;

    void (async () => {
      try {
        const unread = await getUnreadCount(uid);

        let pendingActionable = 0;
        if (canApprove) {
          if (isSuperAdmin) {
            const [organizerRows, orgRows, joinRows] = await Promise.all([
              getPendingOrganizerRequests(),
              getPendingOrganizations(),
              getAllPendingJoinRequests(),
            ]);
            pendingActionable = organizerRows.length + orgRows.length + joinRows.length;
          } else {
            const [orgRowsPerVillage, joinRows] = await Promise.all([
              adminVillageIds.length > 0
                ? Promise.all(
                    adminVillageIds.map((vid) => getOrganizationsByMunicipality(vid, 'pending')),
                  )
                : Promise.resolve([]),
              adminOrgIds.length > 0
                ? getPendingJoinRequestsForOrgs(adminOrgIds)
                : Promise.resolve([]),
            ]);
            pendingActionable = orgRowsPerVillage.flat().length + joinRows.length;
          }
        }

        if (!cancelled) setCount(unread + pendingActionable);
      } catch {
        if (!cancelled) setCount(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, approverLoading, canApprove, isSuperAdmin, adminVillageIds, adminOrgIds, refreshToken]);

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), []);

  return { count, refresh };
}
