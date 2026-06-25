import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { HStack, Pressable, Screen, Text } from '../../components/primitives';
import { AppHeader } from '../../components/layout/AppHeader';
import { ProfileHeader } from '../../components/feature/profile/ProfileHeader';
import { ProfileStatsRow } from '../../components/feature/profile/ProfileStatsRow';
import { PersonaScroll } from '../../components/feature/profile/PersonaScroll';
import { ProfileSectionHeader } from '../../components/feature/profile/ProfileSectionHeader';
import { ACCENT, Section, EntityCard } from '../../components/feature/VillageSections';
import type { OrganizationType, OrgMemberRole } from '@cultuvilla/shared/models/organization';
import { useAuth } from '../../lib/auth/useAuth';
import { useShareDeepLink } from '../../lib/deeplink/useShareDeepLink';
import { useT } from '../../lib/i18n';
import { withFirestoreErrorLog } from '../../lib/firestoreErrorLog';
import { pickImageAsBlob } from '../../lib/images';
import {
  getPersonByUserId,
  getPersonsByCreator,
  updatePerson,
} from '@cultuvilla/shared/services/personService';
import { uploadUserPhoto } from '@cultuvilla/shared/services/imageService';
import { getEventsByOrganizer } from '@cultuvilla/shared/services/eventService';
import { getNewsPostsByOrganizer } from '@cultuvilla/shared/services/newsService';
import { getPersonViewLink } from '@cultuvilla/shared/services/deepLinkService';
import { buildDisplayName } from '@cultuvilla/shared/models/person';
import {
  ManagedEventsScroll,
  type ManagedEvent,
} from '../../components/feature/profile/ManagedEventsScroll';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { getOrgMembershipsByUserInMunicipality } from '@cultuvilla/shared/services/orgMemberService';
import { getUserMemberships } from '@cultuvilla/shared/services/villageMemberService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { setActiveMunicipality } from '@cultuvilla/shared/services/userService';
import { escudoFullUrl, hasManualEscudo } from '@cultuvilla/shared/models/municipality';
import { VillagesScroll, type VillageRow } from '../../components/feature/profile/VillagesScroll';
import {
  CreatedNewsScroll,
  type CreatedNews,
} from '../../components/feature/profile/CreatedNewsScroll';
import type { PersonData } from '@cultuvilla/shared/models/person';

type PersonDoc = PersonData & { id: string };

/** An organization the user belongs to, shaped for the profile card scrolls. */
type MemberOrg = {
  id: string;
  name: string;
  type: OrganizationType;
  imageURL: string | null;
  role: OrgMemberRole;
};

export default function ProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useT();
  const share = useShareDeepLink();

  const [selfPerson, setSelfPerson] = useState<PersonDoc | null>(null);
  const [allPersonas, setAllPersonas] = useState<PersonDoc[]>([]);
  const [eventsCreated, setEventsCreated] = useState<number | null>(null);
  const [managedEvents, setManagedEvents] = useState<ManagedEvent[]>([]);
  const [newsCount, setNewsCount] = useState<number | null>(null);
  const [createdNews, setCreatedNews] = useState<CreatedNews[]>([]);
  const [orgs, setOrgs] = useState<MemberOrg[]>([]);
  const [villages, setVillages] = useState<VillageRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const activeMunicipalityId = profile?.activeMunicipalityId ?? null;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [self, mine] = await Promise.all([
        withFirestoreErrorLog('profile:getPersonByUserId', () => getPersonByUserId(user.uid)),
        withFirestoreErrorLog('profile:getPersonsByCreator', () => getPersonsByCreator(user.uid)),
      ]);
      setSelfPerson(self);
      setAllPersonas(mine);

      const [myEvents, news] = await Promise.all([
        withFirestoreErrorLog('profile:getEventsByOrganizer', () =>
          getEventsByOrganizer(user.uid),
        ),
        withFirestoreErrorLog('profile:getNewsPostsByOrganizer', () =>
          getNewsPostsByOrganizer(user.uid),
        ),
      ]);
      setManagedEvents(myEvents);
      setEventsCreated(myEvents.length);
      setCreatedNews(news);
      setNewsCount(news.length);

      const villageMemberships = await withFirestoreErrorLog('profile:getUserMemberships', () =>
        getUserMemberships(user.uid),
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

      if (activeMunicipalityId) {
        const munOrgs = await withFirestoreErrorLog(
          'profile:getOrganizationsByMunicipality',
          () => getOrganizationsByMunicipality(activeMunicipalityId, 'approved'),
        );
        const memberships = await withFirestoreErrorLog(
          'profile:getOrgMembershipsByUserInMunicipality',
          () =>
            getOrgMembershipsByUserInMunicipality(
              user.uid,
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
  }, [user, activeMunicipalityId]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function onChangePhoto() {
    if (!selfPerson || !user) return;
    const picked = await pickImageAsBlob({ square: true });
    if (!picked) return;
    setUploading(true);
    try {
      // Upload to the user-scoped storage path (rule: auth.uid == userId) and
      // persist the URL on the person doc — same flow as onboarding's
      // complete-profile. The person-scoped path needs a cross-service
      // firestore.get the live project can't resolve, so it 403s.
      const url = await uploadUserPhoto(user.uid, picked);
      await updatePerson(selfPerson.id, { photoURL: url });
      const refreshed = await withFirestoreErrorLog(
        'profile:getPersonByUserId:refresh',
        () => getPersonByUserId(user.uid),
      );
      setSelfPerson(refreshed);
    } finally {
      setUploading(false);
    }
  }

  async function selectVillage(municipalityId: string) {
    if (!user) return;
    await setActiveMunicipality(user.uid, municipalityId);
    await refreshProfile();
    router.replace('/(tabs)/village');
  }

  if (!user) return null;

  const otherPersonas = allPersonas.filter((p) => p.userId !== user.uid);
  // Mirror the village home's org split: everything that isn't a peña falls
  // under "Grupos" (asociación + ayuntamiento + otros), so no membership is lost.
  const grupos = orgs.filter((o) => o.type !== 'peña');
  const penas = orgs.filter((o) => o.type === 'peña');
  const fallbackName = profile?.displayName ?? user.email ?? '';
  const activeVillageName =
    villages.find((v) => v.municipalityId === activeMunicipalityId)?.name ?? null;

  return (
    <Screen padded={false} topInset={false} bottomInset={false}>
      <AppHeader centerLabel={t('header.profile')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <ProfileHeader
          person={selfPerson}
          fallbackName={fallbackName}
          subtitle={activeVillageName}
          uploading={uploading}
          onPressAvatar={onChangePhoto}
        />

        <View className="px-4 pt-4 pb-4">
          <ProfileStatsRow
            stats={[
              { label: t('profile.stats.grupos'), value: grupos.length },
              { label: t('profile.stats.eventsCreated'), value: eventsCreated },
              { label: t('profile.stats.news'), value: newsCount },
            ]}
          />
        </View>

        {selfPerson ? (
          <HStack gap={3} className="px-4 pt-2 pb-2">
            <Pressable
              onPress={() => router.push(`/person/${selfPerson.id}`)}
              accessibilityLabel={t('profile.actions.edit')}
              className="flex-1 flex-row items-center justify-center bg-surface"
              style={{
                paddingVertical: 5,
                paddingHorizontal: 12,
                borderRadius: 24,
                borderWidth: 1.5,
                borderColor: ACCENT,
                minHeight: 32,
              }}
            >
              <Text style={{ color: ACCENT }} className="font-semibold">
                {t('profile.actions.edit')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                void share(getPersonViewLink(selfPerson.id), buildDisplayName(selfPerson))
              }
              accessibilityLabel={t('profile.actions.share')}
              className="flex-1 flex-row items-center justify-center bg-surface"
              style={{
                paddingVertical: 5,
                paddingHorizontal: 12,
                borderRadius: 24,
                borderWidth: 1.5,
                borderColor: ACCENT,
                minHeight: 32,
              }}
            >
              <Text style={{ color: ACCENT }} className="font-semibold">
                {t('profile.actions.share')}
              </Text>
            </Pressable>
          </HStack>
        ) : null}

        {selfPerson?.biography ? (
          <View className="px-4 mt-4">
            <Text>{selfPerson.biography}</Text>
          </View>
        ) : null}

        <ProfileSectionHeader title={t('profile.personasSection.title')} />
        {loading && allPersonas.length === 0 ? (
          <View className="px-4">
            <ActivityIndicator />
          </View>
        ) : (
          <PersonaScroll
            personas={otherPersonas}
            addLabel={t('profile.personasSection.add')}
            emptyLabel={t('profile.personasSection.empty')}
            onPressPersona={(id) => router.push(`/person/${id}`)}
            onPressAdd={() => router.push('/person/new')}
          />
        )}

        {managedEvents.length > 0 ? (
          <>
            <ProfileSectionHeader title={t('profile.managedEventsSection.title')} />
            <ManagedEventsScroll
              events={managedEvents}
              now={new Date()}
              ongoingLabel={t('profile.managedEventsSection.ongoing')}
              emptyLabel={t('profile.managedEventsSection.empty')}
              onPressEvent={(id) => router.push(`/event/${id}` as never)}
            />
          </>
        ) : null}

        {createdNews.length > 0 ? (
          <>
            <ProfileSectionHeader title={t('profile.createdNewsSection.title')} />
            <CreatedNewsScroll
              news={createdNews}
              emptyLabel={t('profile.createdNewsSection.empty')}
              onPressNews={(id) => router.push(`/news/${id}` as never)}
            />
          </>
        ) : null}

        {grupos.length > 0 ? (
          <Section
            title={t('profile.gruposSection.title')}
            isEmpty={false}
            emptyLabel={t('profile.gruposSection.empty')}
          >
            {grupos.map((o) => (
              <EntityCard
                key={o.id}
                label={o.name}
                sub={t(`profile.orgRole.${o.role}`)}
                icon="business-outline"
                imageUri={o.imageURL}
                onPress={() => router.push(`/o/${o.id}` as never)}
              />
            ))}
          </Section>
        ) : null}

        {penas.length > 0 ? (
          <Section
            title={t('profile.peñasSection.title')}
            isEmpty={false}
            emptyLabel={t('profile.peñasSection.empty')}
          >
            {penas.map((o) => (
              <EntityCard
                key={o.id}
                label={o.name}
                sub={t(`profile.orgRole.${o.role}`)}
                icon="people-circle-outline"
                imageUri={o.imageURL}
                onPress={() => router.push(`/o/${o.id}` as never)}
              />
            ))}
          </Section>
        ) : null}

        {villages.length > 0 ? (
          <>
            <ProfileSectionHeader title={t('profile.villagesEntry')} />
            <VillagesScroll
              villages={villages}
              activeId={activeMunicipalityId}
              joinLabel={t('profile.villagesSection.join')}
              emptyLabel={t('me.villages.empty')}
              onPressVillage={(id) => void selectVillage(id)}
              onPressJoin={() => router.push('/discover')}
            />
          </>
        ) : null}

      </ScrollView>
    </Screen>
  );
}
