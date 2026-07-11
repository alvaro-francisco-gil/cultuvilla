import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './auth/useAuth';
import { withFirestoreErrorLog } from './firestoreErrorLog';
import {
  getMunicipality,
  getBarrios,
  getPlaces,
} from '@cultuvilla/shared/services/municipalityService';
import {
  isVillageAdmin,
  getVillageMembers,
} from '@cultuvilla/shared/services/villageMemberService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { getOrgMemberCount } from '@cultuvilla/shared/services/orgMemberService';
import { getBarrioResidentCount } from '@cultuvilla/shared/services/personService';
import { getMyOrganizerRequests } from '@cultuvilla/shared/services/organizerRequestService';
import { getEventsByMunicipality } from '@cultuvilla/shared/services/eventService';
import { getHomeFeed } from '@cultuvilla/shared/services/newsService';
import {
  getFestivalPosters,
  type FestivalPosterWithId,
} from '@cultuvilla/shared/services/festivalPosterService';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { BarrioData, PlaceData } from '@cultuvilla/shared/models/municipality';
import type { OrganizationData } from '@cultuvilla/shared/models/organization';
import type { EventData } from '@cultuvilla/shared/models/event';
import type { NewsPostData } from '@cultuvilla/shared/models/news/NewsPostDataModel';
import type { ProfileAnswers } from '@cultuvilla/shared/models/municipality/CensoTypes';

export interface VillageHomeState {
  loading: boolean;
  loadError: string | null;
  village: (MunicipalityData & { id: string }) | null;
  villageAdmin: boolean;
  isMember: boolean;
  barrios: (BarrioData & { id: string })[];
  places: (PlaceData & { id: string })[];
  organizations: (OrganizationData & { id: string })[];
  orgMemberCounts: Record<string, number>;
  /** Resident count per barrio id (people who picked that specific barrio). */
  barrioResidentCounts: Record<string, number>;
  events: (EventData & { id: string })[];
  news: (NewsPostData & { id: string })[];
  festivalPosters: FestivalPosterWithId[];
  peopleCount: number;
  pendingOrganizerRequest: boolean;
  /** The current user's censo answers (empty if not a member / none yet). */
  myCensoAnswers: ProfileAnswers;
}

const EMPTY: VillageHomeState = {
  loading: false,
  loadError: null,
  village: null,
  villageAdmin: false,
  isMember: false,
  barrios: [],
  places: [],
  organizations: [],
  orgMemberCounts: {},
  barrioResidentCounts: {},
  events: [],
  news: [],
  festivalPosters: [],
  peopleCount: 0,
  pendingOrganizerRequest: false,
  myCensoAnswers: {},
};

/**
 * Loads everything the village home (pueblo tab + pushed detail) needs for one
 * municipality and re-runs on focus. Presentation lives in <VillageHomeBody>;
 * this hook is the single place village-home data is fetched.
 */
export function useVillageHome(municipalityId: string | null) {
  const { user } = useAuth();
  // Depend on the stable uid primitive, not the `user` object — the AuthContext
  // value can be a fresh object per render; keying `reload` off `uid` keeps it
  // stable so the focus/mount effects don't re-fire in a loop.
  const uid = user?.uid ?? null;
  const [state, setState] = useState<VillageHomeState>({ ...EMPTY, loading: !!municipalityId });

  const reload = useCallback(async () => {
    if (!municipalityId) {
      setState({ ...EMPTY });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const [mun, isAdmin, myReqs, bar, plc, members, evts, nws, posters] = await Promise.all([
        withFirestoreErrorLog('villageHome:getMunicipality', () => getMunicipality(municipalityId)),
        uid
          ? withFirestoreErrorLog('villageHome:isVillageAdmin', () =>
              isVillageAdmin(municipalityId, uid),
            )
          : Promise.resolve(false),
        uid
          ? withFirestoreErrorLog('villageHome:getMyOrganizerRequests', () =>
              getMyOrganizerRequests(uid),
            )
          : Promise.resolve([]),
        withFirestoreErrorLog('villageHome:getBarrios', () => getBarrios(municipalityId)),
        withFirestoreErrorLog('villageHome:getPlaces', () => getPlaces(municipalityId)),
        withFirestoreErrorLog('villageHome:getVillageMembers', () =>
          getVillageMembers(municipalityId),
        ),
        withFirestoreErrorLog('villageHome:getEvents', () =>
          getEventsByMunicipality(municipalityId, 'published'),
        ),
        withFirestoreErrorLog('villageHome:getNews', () =>
          getHomeFeed(municipalityId, { limit: 10 }),
        ),
        withFirestoreErrorLog('villageHome:getFestivalPosters', () =>
          getFestivalPosters(municipalityId),
        ),
      ]);

      const orgs = await withFirestoreErrorLog('villageHome:getOrganizations', () =>
        getOrganizationsByMunicipality(municipalityId),
      );

      // evts arrives sorted ascending by startDate. Show upcoming events first
      // (soonest first), then past events (most recent first).
      const now = new Date();
      const upcoming = evts.filter((e) => e.startDate >= now);
      const past = evts.filter((e) => e.startDate < now).reverse();
      const orderedEvents = [...upcoming, ...past];

      const counts = await Promise.all(
        orgs.map((o) =>
          withFirestoreErrorLog('villageHome:getOrgMemberCount', () => getOrgMemberCount(o.id)),
        ),
      );
      const countByOrg: Record<string, number> = {};
      orgs.forEach((o, i) => {
        countByOrg[o.id] = counts[i] ?? 0;
      });

      const barrioCounts = await Promise.all(
        bar.map((b) =>
          withFirestoreErrorLog('villageHome:getBarrioResidentCount', () =>
            getBarrioResidentCount(municipalityId, b.id),
          ),
        ),
      );
      const countByBarrio: Record<string, number> = {};
      bar.forEach((b, i) => {
        countByBarrio[b.id] = barrioCounts[i] ?? 0;
      });

      setState({
        loading: false,
        loadError: null,
        village: mun,
        villageAdmin: isAdmin,
        isMember: uid != null && members.some((m) => m.userId === uid),
        barrios: bar,
        places: plc,
        organizations: orgs,
        orgMemberCounts: countByOrg,
        barrioResidentCounts: countByBarrio,
        events: orderedEvents,
        news: nws,
        festivalPosters: posters,
        peopleCount: members.length,
        pendingOrganizerRequest: myReqs.some(
          (r) => r.municipalityId === municipalityId && r.status === 'pending',
        ),
        myCensoAnswers:
          (uid != null ? members.find((m) => m.userId === uid)?.profileAnswers : undefined) ?? {},
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[useVillageHome] reload ERR', msg);
      setState((s) => ({ ...s, loading: false, loadError: msg }));
    }
  }, [municipalityId, uid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { ...state, reload };
}
