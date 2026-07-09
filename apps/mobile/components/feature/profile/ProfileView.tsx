import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { HStack, Pressable, Text } from '../../primitives';
import { ProfileHeader } from './ProfileHeader';
import { ProfileStatsRow } from './ProfileStatsRow';
import { PersonaScroll } from './PersonaScroll';
import { ProfileSectionHeader } from './ProfileSectionHeader';
import { ACCENT, Section, EntityCard } from '../VillageSections';
import { useShareDeepLink } from '../../../lib/deeplink/useShareDeepLink';
import { useT } from '../../../lib/i18n';
import { withFirestoreErrorLog } from '../../../lib/firestoreErrorLog';
import { pickImageAsBlob } from '../../../lib/images';
import { updatePerson } from '@cultuvilla/shared/services/personService';
import { uploadUserPhoto } from '@cultuvilla/shared/services/imageService';
import { getPersonViewLink } from '@cultuvilla/shared/services/deepLinkService';
import { buildDisplayName } from '@cultuvilla/shared/models/person';
import { ManagedEventsScroll } from './ManagedEventsScroll';
import { VillagesScroll } from './VillagesScroll';
import { CreatedNewsScroll } from './CreatedNewsScroll';
import { useProfileData } from '../../../lib/profile/useProfileData';

export interface ProfileViewProps {
  uid: string;
  activeMunicipalityId: string | null;
  variant: 'self' | 'other';
  fallbackName: string;
  /** Self-only: village switching needs refreshProfile + router.replace, which are screen concerns. */
  onSelectVillage?: (municipalityId: string) => void;
}

export function ProfileView({
  uid,
  activeMunicipalityId,
  variant,
  fallbackName,
  onSelectVillage,
}: ProfileViewProps) {
  const { t } = useT();
  const share = useShareDeepLink();
  const [uploading, setUploading] = useState(false);
  const isSelf = variant === 'self';

  const {
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
    reload,
  } = useProfileData(uid, activeMunicipalityId, variant);

  async function onChangePhoto() {
    if (!selfPerson) return;
    const picked = await pickImageAsBlob({ square: true });
    if (!picked) return;
    setUploading(true);
    try {
      // Upload to the user-scoped storage path (rule: auth.uid == userId) and
      // persist the URL on the person doc — same flow as onboarding's
      // complete-profile. The person-scoped path needs a cross-service
      // firestore.get the live project can't resolve, so it 403s.
      const url = await uploadUserPhoto(uid, picked);
      await updatePerson(selfPerson.id, { photoURL: url });
      await reload();
    } finally {
      setUploading(false);
    }
  }

  const otherPersonas = allPersonas.filter((p) => p.userId !== uid);
  // Mirror the village home's org split: everything that isn't a peña falls
  // under "Grupos" (asociación + ayuntamiento + otros), so no membership is lost.
  const grupos = orgs.filter((o) => o.type !== 'peña');
  const penas = orgs.filter((o) => o.type === 'peña');
  const activeVillageName =
    villages.find((v) => v.municipalityId === activeMunicipalityId)?.name ?? null;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <ProfileHeader
        person={selfPerson}
        fallbackName={fallbackName}
        subtitle={activeVillageName}
        uploading={isSelf ? uploading : false}
        onPressAvatar={isSelf ? onChangePhoto : undefined}
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

      {isSelf && selfPerson ? (
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
          addLabel={isSelf ? t('profile.personasSection.add') : undefined}
          emptyLabel={t('profile.personasSection.empty')}
          onPressPersona={(id) => router.push(`/person/${id}`)}
          onPressAdd={isSelf ? () => router.push('/person/new') : undefined}
          showAdd={isSelf}
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

      {newsError ? (
        <>
          <ProfileSectionHeader title={t('profile.createdNewsSection.title')} />
          <View className="px-4">
            <Text tone="danger">{t('profile.createdNewsSection.error')}</Text>
          </View>
        </>
      ) : createdNews.length > 0 ? (
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
            joinLabel={isSelf ? t('profile.villagesSection.join') : undefined}
            emptyLabel={t('me.villages.empty')}
            onPressVillage={(id) =>
              isSelf
                ? onSelectVillage?.(id)
                : router.push({ pathname: '/village/[villageId]', params: { villageId: id } })
            }
            onPressJoin={isSelf ? () => router.push('/discover') : undefined}
            showJoin={isSelf}
          />
        </>
      ) : null}
    </ScrollView>
  );
}
