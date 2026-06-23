import { useEffect, useState } from 'react';
import { isAppAdmin as isAppAdminService } from '@cultuvilla/shared/services/adminService';
import { getUserMemberships } from '@cultuvilla/shared/services/villageMemberService';
import {
  getOrgMembershipsByUserInMunicipality,
} from '@cultuvilla/shared/services/orgMemberService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { useAuth } from './useAuth';

export interface ApproverStatus {
  loading: boolean;
  isSuperAdmin: boolean;
  adminVillageIds: string[];
  adminOrgIds: string[];
  canApprove: boolean;
}

const NOT_APPROVER: ApproverStatus = {
  loading: false,
  isSuperAdmin: false,
  adminVillageIds: [],
  adminOrgIds: [],
  canApprove: false,
};

export function useApproverStatus(): ApproverStatus {
  const { user } = useAuth();

  const [state, setState] = useState<ApproverStatus>({ ...NOT_APPROVER, loading: true });

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setState(NOT_APPROVER);
      return;
    }

    setState((s) => ({ ...s, loading: true }));

    void (async () => {
      try {
        const [isSuperAdmin, memberships] = await Promise.all([
          isAppAdminService(user.uid),
          getUserMemberships(user.uid),
        ]);

        if (cancelled) return;

        const adminVillageIds = memberships
          .filter((m) => m.role === 'admin')
          .map((m) => m.municipalityId);

        // For each village the user belongs to, fetch approved orgs and check org membership.
        const perVillageOrgAdminIds = await Promise.all(
          memberships.map(async (m) => {
            const orgs = await getOrganizationsByMunicipality(m.municipalityId, 'approved');
            const orgIds = orgs.map((o) => o.id);
            if (orgIds.length === 0) return [];
            const orgMemberships = await getOrgMembershipsByUserInMunicipality(
              user.uid,
              m.municipalityId,
              orgIds,
            );
            return orgMemberships.filter((om) => om.role === 'admin').map((om) => om.orgId);
          }),
        );

        if (cancelled) return;

        const adminOrgIds = [...new Set(perVillageOrgAdminIds.flat())];

        const next: ApproverStatus = {
          loading: false,
          isSuperAdmin,
          adminVillageIds,
          adminOrgIds,
          canApprove: isSuperAdmin || adminVillageIds.length > 0 || adminOrgIds.length > 0,
        };
        setState(next);
      } catch {
        // Treat any fetch failure as not-an-approver rather than throwing.
        if (!cancelled) setState(NOT_APPROVER);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return state;
}
