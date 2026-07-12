import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  eventEndBoundary,
  isStartDayOver,
} from '@cultuvilla/shared/models/event/EventDataModel';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { BarrioData, PlaceData } from '@cultuvilla/shared/models/municipality';
import type { OrganizationData } from '@cultuvilla/shared/models/organization';
import type { EventData } from '@cultuvilla/shared/models/event';
import type { NewsPostData } from '@cultuvilla/shared/models/news/NewsPostDataModel';
import type { ProfileAnswers } from '@cultuvilla/shared/models/municipality/CensoTypes';

/** Independent scroll on the village home; each loads and can fail on its own. */
export type VillageSectionKey =
  | 'events'
  | 'news'
  | 'festivalPosters'
  | 'barrios'
  | 'places'
  | 'organizations';

export type SectionStatus = 'loading' | 'ready' | 'error';

export type SectionStatusMap = Record<VillageSectionKey, SectionStatus>;

export interface VillageHomeState {
  /** The essential village doc is still loading — the whole tab waits on this. */
  coreLoading: boolean;
  /** The essential village fetch failed — the whole tab shows an error. */
  coreError: string | null;
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
  /** null while the members fetch is in flight, so the stat renders "—". */
  peopleCount: number | null;
  pendingOrganizerRequest: boolean;
  /** The current user's censo answers (empty if not a member / none yet). */
  myCensoAnswers: ProfileAnswers;
  /** Per-scroll load state; each section renders a skeleton until 'ready'. */
  sectionStatus: SectionStatusMap;
}

const ALL_LOADING: SectionStatusMap = {
  events: 'loading',
  news: 'loading',
  festivalPosters: 'loading',
  barrios: 'loading',
  places: 'loading',
  organizations: 'loading',
};

const EMPTY: VillageHomeState = {
  coreLoading: false,
  coreError: null,
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
  peopleCount: null,
  pendingOrganizerRequest: false,
  myCensoAnswers: {},
  sectionStatus: ALL_LOADING,
};

/**
 * Loads everything the village home (pueblo tab + pushed detail) needs for one
 * municipality and re-runs on focus. Presentation lives in <VillageHomeBody>;
 * this hook is the single place village-home data is fetched.
 *
 * Only the village doc is essential: it gates the whole tab. Every other piece
 * (each scroll + the membership/admin chrome) loads independently so one slow
 * or failing fetch shows a skeleton / hides its own row instead of blanking the
 * tab. A run counter drops writes from a superseded reload (focus re-fire or a
 * municipality switch) so stale flows never land on the current village.
 */
export function useVillageHome(municipalityId: string | null) {
  const { user } = useAuth();
  // Depend on the stable uid primitive, not the `user` object — the AuthContext
  // value can be a fresh object per render; keying `reload` off `uid` keeps it
  // stable so the focus/mount effects don't re-fire in a loop.
  const uid = user?.uid ?? null;
  const [state, setState] = useState<VillageHomeState>({
    ...EMPTY,
    coreLoading: !!municipalityId,
  });
  const runId = useRef(0);

  const reload = useCallback(async () => {
    if (!municipalityId) {
      runId.current += 1;
      setState({ ...EMPTY });
      return;
    }
    const myRun = (runId.current += 1);
    // Only the latest reload may commit; a superseded flow no-ops. Guards both
    // the focus re-fire and a municipality switch mid-flight.
    const commit = (updater: (prev: VillageHomeState) => VillageHomeState) =>
      setState((prev) => (runId.current === myRun ? updater(prev) : prev));

    setState({ ...EMPTY, coreLoading: true, sectionStatus: { ...ALL_LOADING } });

    let village: (MunicipalityData & { id: string }) | null;
    try {
      village = await withFirestoreErrorLog('villageHome:getMunicipality', () =>
        getMunicipality(municipalityId),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      commit((s) => ({ ...s, coreLoading: false, coreError: msg }));
      return;
    }
    commit((s) => ({ ...s, coreLoading: false, village }));

    const markSection = (key: VillageSectionKey, status: SectionStatus) =>
      commit((s) => ({ ...s, sectionStatus: { ...s.sectionStatus, [key]: status } }));

    const loadChrome = async () => {
      try {
        const [isAdmin, myReqs, members] = await Promise.all([
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
          withFirestoreErrorLog('villageHome:getVillageMembers', () =>
            getVillageMembers(municipalityId),
          ),
        ]);
        commit((s) => ({
          ...s,
          villageAdmin: isAdmin,
          isMember: uid != null && members.some((m) => m.userId === uid),
          peopleCount: members.length,
          pendingOrganizerRequest: myReqs.some(
            (r) => r.municipalityId === municipalityId && r.status === 'pending',
          ),
          myCensoAnswers:
            (uid != null ? members.find((m) => m.userId === uid)?.profileAnswers : undefined) ?? {},
        }));
      } catch {
        // Chrome degrades silently to the non-member view; the error is already
        // logged by withFirestoreErrorLog and must not take down the tab.
      }
    };

    const loadEvents = async () => {
      try {
        // published + completed so past events survive the hourly completion job;
        // cancelled is excluded by the query.
        const evts = await withFirestoreErrorLog('villageHome:getEvents', () =>
          getEventsByMunicipality(municipalityId, ['published', 'completed']),
        );
        // Split on the end boundary, not startDate, so a multi-day event still
        // running counts as upcoming. Upcoming first (soonest first), then past
        // (most recent first). evts arrives sorted ascending by startDate.
        const now = new Date();
        const isPast = (e: EventData) => isStartDayOver(eventEndBoundary(e), now);
        const upcoming = evts.filter((e) => !isPast(e));
        const past = evts.filter(isPast).reverse();
        commit((s) => ({
          ...s,
          events: [...upcoming, ...past],
          sectionStatus: { ...s.sectionStatus, events: 'ready' },
        }));
      } catch {
        markSection('events', 'error');
      }
    };

    const loadNews = async () => {
      try {
        const nws = await withFirestoreErrorLog('villageHome:getNews', () =>
          getHomeFeed(municipalityId, { limit: 10 }),
        );
        commit((s) => ({
          ...s,
          news: nws,
          sectionStatus: { ...s.sectionStatus, news: 'ready' },
        }));
      } catch {
        markSection('news', 'error');
      }
    };

    const loadPosters = async () => {
      try {
        const posters = await withFirestoreErrorLog('villageHome:getFestivalPosters', () =>
          getFestivalPosters(municipalityId),
        );
        commit((s) => ({
          ...s,
          festivalPosters: posters,
          sectionStatus: { ...s.sectionStatus, festivalPosters: 'ready' },
        }));
      } catch {
        markSection('festivalPosters', 'error');
      }
    };

    const loadPlaces = async () => {
      try {
        const plc = await withFirestoreErrorLog('villageHome:getPlaces', () =>
          getPlaces(municipalityId),
        );
        commit((s) => ({
          ...s,
          places: plc,
          sectionStatus: { ...s.sectionStatus, places: 'ready' },
        }));
      } catch {
        markSection('places', 'error');
      }
    };

    const loadBarrios = async () => {
      try {
        const bar = await withFirestoreErrorLog('villageHome:getBarrios', () =>
          getBarrios(municipalityId),
        );
        const counts = await Promise.all(
          bar.map((b) =>
            withFirestoreErrorLog('villageHome:getBarrioResidentCount', () =>
              getBarrioResidentCount(municipalityId, b.id),
            ),
          ),
        );
        const countByBarrio: Record<string, number> = {};
        bar.forEach((b, i) => {
          countByBarrio[b.id] = counts[i] ?? 0;
        });
        commit((s) => ({
          ...s,
          barrios: bar,
          barrioResidentCounts: countByBarrio,
          sectionStatus: { ...s.sectionStatus, barrios: 'ready' },
        }));
      } catch {
        markSection('barrios', 'error');
      }
    };

    const loadOrgs = async () => {
      try {
        const orgs = await withFirestoreErrorLog('villageHome:getOrganizations', () =>
          getOrganizationsByMunicipality(municipalityId),
        );
        const counts = await Promise.all(
          orgs.map((o) =>
            withFirestoreErrorLog('villageHome:getOrgMemberCount', () => getOrgMemberCount(o.id)),
          ),
        );
        const countByOrg: Record<string, number> = {};
        orgs.forEach((o, i) => {
          countByOrg[o.id] = counts[i] ?? 0;
        });
        commit((s) => ({
          ...s,
          organizations: orgs,
          orgMemberCounts: countByOrg,
          sectionStatus: { ...s.sectionStatus, organizations: 'ready' },
        }));
      } catch {
        markSection('organizations', 'error');
      }
    };

    await Promise.allSettled([
      loadChrome(),
      loadEvents(),
      loadNews(),
      loadPosters(),
      loadPlaces(),
      loadBarrios(),
      loadOrgs(),
    ]);
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
