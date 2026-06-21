import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, Screen, Text } from '../../components/primitives';
import { AppHeader } from '../../components/layout/AppHeader';
import { ProfileHeader } from '../../components/feature/profile/ProfileHeader';
import { ProfileStatsRow } from '../../components/feature/profile/ProfileStatsRow';
import { PersonaScroll } from '../../components/feature/profile/PersonaScroll';
import { OrgList } from '../../components/feature/profile/OrgList';
import type { OrgListItem } from '../../components/feature/profile/OrgList';
import { ProfileSectionHeader } from '../../components/feature/profile/ProfileSectionHeader';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { withFirestoreErrorLog } from '../../lib/firestoreErrorLog';
import { pickImageAsBlob } from '../../lib/images';
import {
  getPersonByUserId,
  getPersonsByCreator,
  updatePerson,
} from '@cultuvilla/shared/services/personService';
import { uploadUserPhoto } from '@cultuvilla/shared/services/imageService';
import { getEventCountByCreator } from '@cultuvilla/shared/services/eventService';
import { getUserRegistrationsAcrossEvents } from '@cultuvilla/shared/services/registrationService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { getOrgMembershipsByUserInMunicipality } from '@cultuvilla/shared/services/orgMemberService';
import { getUserMemberships } from '@cultuvilla/shared/services/villageMemberService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { setActiveMunicipality } from '@cultuvilla/shared/services/userService';
import { escudoThumbDisplayUrl } from '@cultuvilla/shared/models/municipality';
import { VillagesScroll, type VillageRow } from '../../components/feature/profile/VillagesScroll';
import type { PersonData } from '@cultuvilla/shared/models/person';

type PersonDoc = PersonData & { id: string };

export default function ProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useT();

  const [selfPerson, setSelfPerson] = useState<PersonDoc | null>(null);
  const [allPersonas, setAllPersonas] = useState<PersonDoc[]>([]);
  const [eventsCreated, setEventsCreated] = useState<number | null>(null);
  const [participations, setParticipations] = useState<number | null>(null);
  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
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

      const [count, regs] = await Promise.all([
        withFirestoreErrorLog('profile:getEventCountByCreator', () =>
          getEventCountByCreator(user.uid),
        ),
        withFirestoreErrorLog('profile:getUserRegistrationsAcrossEvents', () =>
          getUserRegistrationsAcrossEvents(user.uid),
        ),
      ]);
      setEventsCreated(count);
      const distinctEvents = new Set(regs.map((r) => r.eventPath));
      setParticipations(distinctEvents.size);

      const memberships = await withFirestoreErrorLog('profile:getUserMemberships', () =>
        getUserMemberships(user.uid),
      );
      const villageRows = await Promise.all(
        memberships.map(async (m) => {
          const muni = await withFirestoreErrorLog('profile:getMunicipality', () =>
            getMunicipality(m.municipalityId),
          );
          return {
            municipalityId: m.municipalityId,
            name: muni?.name ?? m.municipalityId,
            escudoThumbUrl: muni ? escudoThumbDisplayUrl(muni) : null,
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
        const memberOrgIds = new Set(memberships.map((m) => m.orgId));
        setOrgs(
          munOrgs
            .filter((o) => memberOrgIds.has(o.id))
            .map((o) => ({ id: o.id, name: o.name })),
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
  const fallbackName = profile?.displayName ?? user.email ?? '';

  return (
    <Screen padded={false} topInset={false} bottomInset={false}>
      <AppHeader centerLabel={t('header.profile')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <ProfileHeader
          person={selfPerson}
          fallbackName={fallbackName}
          uploading={uploading}
          onPressAvatar={onChangePhoto}
        />

        <View className="px-4">
          <ProfileStatsRow
            stats={[
              { label: t('profile.stats.eventsCreated'), value: eventsCreated },
              { label: t('profile.stats.participations'), value: participations },
              { label: t('profile.stats.personas'), value: allPersonas.length },
            ]}
          />
        </View>

        {selfPerson?.biography ? (
          <View className="px-4 mt-4">
            <Text>{selfPerson.biography}</Text>
          </View>
        ) : selfPerson ? (
          <View className="px-4 mt-4">
            <Pressable
              onPress={() => router.push(`/person/${selfPerson.id}`)}
              accessibilityRole="button"
            >
              <Text tone="muted">
                {t('profile.bio.empty')} · {t('profile.bio.cta')}
              </Text>
            </Pressable>
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

        {orgs.length > 0 ? (
          <>
            <ProfileSectionHeader title={t('profile.orgsSection.title')} />
            <OrgList
              orgs={orgs}
              emptyLabel={t('profile.orgsSection.empty')}
              defaultRoleLabel={t('profile.orgsSection.roleMember')}
            />
          </>
        ) : null}

        <ProfileSectionHeader title={t('profile.villagesEntry')} />
        <VillagesScroll
          villages={villages}
          activeId={activeMunicipalityId}
          joinLabel={t('profile.villagesSection.join')}
          emptyLabel={t('me.villages.empty')}
          badges={{
            active: t('me.villages.activeBadge'),
            admin: t('me.villages.adminBadge'),
            member: t('me.villages.memberBadge'),
          }}
          onPressVillage={(id) => void selectVillage(id)}
          onPressJoin={() => router.push('/discover')}
        />

      </ScrollView>
    </Screen>
  );
}
