import { useEffect, useState } from 'react';
import { isAppAdmin as isAppAdminService } from '@cultuvilla/shared/services/adminService';
import { getVillageMember } from '@cultuvilla/shared/services/villageMemberService';
import {
  getOrgMembershipsByUserInMunicipality,
} from '@cultuvilla/shared/services/orgMemberService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { useAuth } from './useAuth';

export interface ApproverStatus {
  loading: boolean;
  isSuperAdmin: boolean;
  isVillageAdmin: boolean;
  adminOrgIds: string[];
  canApprove: boolean;
}

const NOT_APPROVER: ApproverStatus = {
  loading: false,
  isSuperAdmin: false,
  isVillageAdmin: false,
  adminOrgIds: [],
  canApprove: false,
};

export function useApproverStatus(): ApproverStatus {
  const { user, profile } = useAuth();
  const municipalityId = profile?.activeMunicipalityId ?? null;

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
        const [superAdmin, vMember, orgs] = await Promise.all([
          isAppAdminService(user.uid),
          municipalityId ? getVillageMember(municipalityId, user.uid) : Promise.resolve(null),
          municipalityId
            ? getOrganizationsByMunicipality(municipalityId, 'approved')
            : Promise.resolve([]),
        ]);

        if (cancelled) return;

        const villageAdmin = vMember?.role === 'admin';

        const orgIds = orgs.map((o) => o.id);
        const orgMemberships = municipalityId
          ? await getOrgMembershipsByUserInMunicipality(user.uid, municipalityId, orgIds)
          : [];

        if (cancelled) return;

        const adminOrgIds = orgMemberships
          .filter((m) => m.role === 'admin')
          .map((m) => m.orgId);

        const next: ApproverStatus = {
          loading: false,
          isSuperAdmin: superAdmin,
          isVillageAdmin: villageAdmin,
          adminOrgIds,
          canApprove: superAdmin || villageAdmin || adminOrgIds.length > 0,
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
  }, [user, municipalityId]);

  return state;
}
