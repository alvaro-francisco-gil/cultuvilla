import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { OrganizationType, OrgMemberRole } from '@cultuvilla/shared/models/organization';
import type { PersonData } from '@cultuvilla/shared/models/person';
import { getPersonByUserId, getPersonsByCreator } from '@cultuvilla/shared/services/personService';
import { getEventsByOrganizer } from '@cultuvilla/shared/services/eventService';
import {
  getApprovedNewsPostsByOrganizer,
  getNewsPostsByOrganizer,
} from '@cultuvilla/shared/services/newsService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { getOrgMembershipsByUserInMunicipality } from '@cultuvilla/shared/services/orgMemberService';
import { getUserMemberships } from '@cultuvilla/shared/services/villageMemberService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { escudoFullUrl, hasManualEscudo } from '@cultuvilla/shared/models/municipality';
import { withFirestoreErrorLog } from '../firestoreErrorLog';
import type { ManagedEvent } from '../../components/feature/profile/ManagedEventsScroll';
import type { CreatedNews } from '../../components/feature/profile/CreatedNewsScroll';
import type { VillageRow } from '../../components/feature/profile/VillagesScroll';

type PersonDoc = PersonData & { id: string };

/** An organization the user belongs to, shaped for the profile card scrolls. */
type MemberOrg = {
  id: string;
  name: string;
  type: OrganizationType;
  imageURL: string | null;
  role: OrgMemberRole;
};

type ProfileData = {
  selfPerson: PersonDoc | null;
  allPersonas: PersonDoc[];
  eventsCreated: number | null;
  managedEvents: ManagedEvent[];
  newsCount: number | null;
  createdNews: CreatedNews[];
  newsError: boolean;
  orgs: MemberOrg[];
  villages: VillageRow[];
  loading: boolean;
  reload: () => Promise<void>;
};

export function useProfileData(
  uid: string | null,
  activeMunicipalityId: string | null,
  variant: 'self' | 'other',
): ProfileData {
  const [selfPerson, setSelfPerson] = useState<PersonDoc | null>(null);
  const [allPersonas, setAllPersonas] = useState<PersonDoc[]>([]);
  const [eventsCreated, setEventsCreated] = useState<number | null>(null);
  const [managedEvents, setManagedEvents] = useState<ManagedEvent[]>([]);
  const [newsCount, setNewsCount] = useState<number | null>(null);
  const [createdNews, setCreatedNews] = useState<CreatedNews[]>([]);
  const [newsError, setNewsError] = useState(false);
  const [orgs, setOrgs] = useState<MemberOrg[]>([]);
  const [villages, setVillages] = useState<VillageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) {
      setSelfPerson(null);
      setAllPersonas([]);
      setEventsCreated(null);
      setManagedEvents([]);
      setNewsCount(null);
      setCreatedNews([]);
      setNewsError(false);
      setOrgs([]);
      setVillages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNewsError(false);
    try {
      const [self, mine] = await Promise.all([
        withFirestoreErrorLog('profile:getPersonByUserId', () => getPersonByUserId(uid)),
        withFirestoreErrorLog('profile:getPersonsByCreator', () => getPersonsByCreator(uid)),
      ]);
      setSelfPerson(self);
      setAllPersonas(mine);

      const myEvents = await withFirestoreErrorLog('profile:getEventsByOrganizer', () =>
        getEventsByOrganizer(uid),
      );
      setManagedEvents(myEvents);
      setEventsCreated(myEvents.length);

      // The organizer news query is denied by rules when the user is an
      // organizer but not the post's creator. Isolate it so the denial shows
      // an error in the news section instead of aborting the whole profile
      // load (it shares the request batch with villages/orgs below) or
      // surfacing as an uncaught promise rejection.
      try {
        const news = await withFirestoreErrorLog('profile:getNewsPostsByOrganizer', () =>
          variant === 'other' ? getApprovedNewsPostsByOrganizer(uid) : getNewsPostsByOrganizer(uid),
        );
        setCreatedNews(news);
        setNewsCount(news.length);
      } catch {
        setNewsError(true);
        setCreatedNews([]);
        setNewsCount(null);
      }

      try {
        const villageMemberships = await withFirestoreErrorLog('profile:getUserMemberships', () =>
          getUserMemberships(uid),
        );
        const villageRows = await Promise.all(
          villageMemberships.map(async (m) => {
            const muni = await withFirestoreErrorLog('profile:getMunicipality', () =>
              getMunicipality(m.municipalityId),
            );
            return {
              municipalityId: m.municipalityId,
              name: muni?.name ?? m.municipalityId,
              comunidadAutonoma: muni?.comunidadAutonoma ?? '',
              escudoUrl: muni ? escudoFullUrl(muni) : null,
              manualEscudo: muni ? hasManualEscudo(muni) : false,
              role: m.role,
            } satisfies VillageRow;
          }),
        );
        setVillages(villageRows);
      } catch {
        setVillages([]);
      }

      if (activeMunicipalityId) {
        const munOrgs = await withFirestoreErrorLog(
          'profile:getOrganizationsByMunicipality',
          () => getOrganizationsByMunicipality(activeMunicipalityId, 'approved'),
        );
        const memberships = await withFirestoreErrorLog(
          'profile:getOrgMembershipsByUserInMunicipality',
          () =>
            getOrgMembershipsByUserInMunicipality(
              uid,
              activeMunicipalityId,
              munOrgs.map((o) => o.id),
            ),
        );
        const roleByOrgId = new Map(memberships.map((m) => [m.orgId, m.role]));
        setOrgs(
          munOrgs
            .filter((o) => roleByOrgId.has(o.id))
            .map((o) => ({
              id: o.id,
              name: o.name,
              type: o.type,
              imageURL: o.imageURL,
              role: roleByOrgId.get(o.id) ?? 'member',
            })),
        );
      } else {
        setOrgs([]);
      }
    } finally {
      setLoading(false);
    }
  }, [uid, activeMunicipalityId, variant]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return {
    selfPerson,
    allPersonas,
    eventsCreated,
    managedEvents,
    newsCount,
    createdNews,
    newsError,
    orgs,
    villages,
    loading,
    reload: load,
  };
}
