import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Alert, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, VStack, HStack, Pressable, Escudo, Button } from '../primitives';
import { VillageInfoModal } from './VillageInfoModal';
import { ACCENT, Stat, StatSeparator, Section, EntityCard } from './VillageSections';
import { useAuth } from '../../lib/auth/useAuth';
import { useIsAppAdmin } from '../../lib/auth/useIsAppAdmin';
import { useShareDeepLink } from '../../lib/deeplink/useShareDeepLink';
import { useT } from '../../lib/i18n';
import { isProposalVisible } from '../../lib/proposals';
import { addVillageMember } from '@cultuvilla/shared/services/villageMemberService';
import {
  getVillageViewLink,
  getVillageInviteLink,
} from '@cultuvilla/shared/services/deepLinkService';
import { formatDate } from '@cultuvilla/shared/utils';
import {
  escudoFullUrl,
  hasManualEscudo,
} from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { VillageHomeState } from '../../lib/useVillageHome';

export interface VillageHomeBodyProps {
  data: VillageHomeState;
  reload: () => Promise<void> | void;
  /** Pushed-detail invite deep-link: show the "you were invited" line above join. */
  arrivedViaInvite?: boolean;
}

/**
 * Presentational village home shared by the pueblo tab and the pushed
 * `/village/[villageId]` detail. Takes data from `useVillageHome`; the host
 * supplies the header chrome (AppHeader vs ScreenHeader). The self-join CTA
 * shows iff `!data.isMember` — the single source of truth for "offer to join".
 */
export function VillageHomeBody({ data, reload, arrivedViaInvite = false }: VillageHomeBodyProps) {
  const { user } = useAuth();
  const { isAppAdmin } = useIsAppAdmin();
  const share = useShareDeepLink();
  const { t } = useT();
  const [infoOpen, setInfoOpen] = useState(false);
  const [joining, setJoining] = useState(false);

  const { loading, loadError, village } = data;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  if (loadError) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text tone="danger">{loadError}</Text>
      </View>
    );
  }
  if (!village) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  // Dormant municipality: offer the self-service "start this village" flow.
  if (!village.communityActive) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <VStack gap={2} className="items-center">
          <Escudo url={escudoFullUrl(village)} size={96} fallbackInitial={village.name} />
          <Text variant="h2" className="mt-2 text-center">
            {village.name}
          </Text>
          <Text tone="muted" variant="bodySm">
            {village.province}
          </Text>
          <Text className="text-center mt-4">{t('village.notRegistered.body')}</Text>
          <Text variant="h3" className="text-center mt-2">
            {t('village.notRegistered.cta')}
          </Text>
          <Button
            className="mt-4"
            onPress={() => router.push(`/discover/start/${village.id}` as never)}
          >
            {t('village.notRegistered.button')}
          </Button>
        </VStack>
      </View>
    );
  }

  const {
    villageAdmin,
    isMember,
    barrios,
    places,
    organizations,
    orgMemberCounts,
    events,
    peopleCount,
    pendingOrganizerRequest,
  } = data;
  const canManage = isAppAdmin || villageAdmin;
  // Wiki phase: active but no organizer granted yet (community.adminUserId null).
  const noOrganizer = village.community?.adminUserId == null;
  const villageBase = `/village/${village.id}` as const;
  const cover = village.community?.coverImages?.[0] ?? null;

  const caps = { canManage, uid: user?.uid ?? null };
  const visibleBarrios = barrios.filter((b) => isProposalVisible(b.status, b.proposedBy, caps));
  const visiblePlaces = places.filter((p) => isProposalVisible(p.status, p.proposedBy, caps));
  const visibleOrgs = organizations.filter((o) => isProposalVisible(o.status, o.requestedBy, caps));
  const penas = visibleOrgs.filter((o) => o.type === 'peña');
  const agrupaciones = visibleOrgs.filter((o) => o.type !== 'peña');

  const onJoin = () => {
    if (!user) {
      router.push('/(auth)/login' as never);
      return;
    }
    const title = t('village.joinConfirm.title');
    const body = t('village.joinConfirm.body');
    const doJoin = async () => {
      setJoining(true);
      try {
        await addVillageMember(village.id, user.uid);
        await reload();
      } finally {
        setJoining(false);
      }
    };
    // react-native-web 0.21 ships Alert.alert as a no-op; use window.confirm on web.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) void doJoin();
      return;
    }
    Alert.alert(title, body, [
      { text: t('village.joinConfirm.cancel'), style: 'cancel' },
      { text: t('village.joinConfirm.confirm'), onPress: () => void doJoin() },
    ]);
  };

  return (
    <>
      <ScrollView contentContainerClassName="pb-10">
        {/* ── Hero ─────────────────────────────────────────────── */}
        {cover ? (
          <Image source={{ uri: cover }} className="w-full h-40" resizeMode="cover" />
        ) : null}
        <VStack gap={2} className="px-4 pt-4">
          <HStack gap={3} className="items-center">
            <View
              className={`bg-surface rounded-2xl shadow-sm ${hasManualEscudo(village) ? '' : 'p-2'}`}
            >
              <Escudo
                url={escudoFullUrl(village)}
                size={88}
                fill={hasManualEscudo(village)}
                fallbackInitial={village.name}
              />
            </View>
            <VStack gap={0} className="flex-1">
              <HStack gap={2} className="items-center">
                <Text variant="h1">{village.name}</Text>
                <Pressable
                  onPress={() => setInfoOpen(true)}
                  accessibilityLabel={t('village.info.title')}
                  className="p-1"
                >
                  <Ionicons name="information-circle-outline" size={24} color={ACCENT} />
                </Pressable>
              </HStack>
              <Text tone="muted" variant="bodySm">
                {village.province}
              </Text>
            </VStack>
          </HStack>
          {/* Wiki phase: a plain member gets a direct entry to edit basic info. */}
          {noOrganizer && isMember && !canManage ? (
            <Pressable
              onPress={() => router.push(`/village/${village.id}/edit-info` as never)}
              accessibilityLabel={t('village.admin.overview.edit')}
              className="flex-row items-center"
            >
              <Ionicons name="create-outline" size={16} color={ACCENT} />
              <Text variant="bodySm" style={{ color: ACCENT }} className="ml-1 font-medium">
                {t('village.admin.overview.edit')}
              </Text>
            </Pressable>
          ) : null}
        </VStack>

        {/* ── Self-join CTA (non-members only) ──────────────────── */}
        {!isMember ? (
          <VStack gap={1} className="px-4 pt-3">
            {arrivedViaInvite ? (
              <Text tone="muted" variant="bodySm" className="text-center">
                {t('village.invitedBanner')}
              </Text>
            ) : null}
            <Pressable
              onPress={onJoin}
              disabled={joining}
              accessibilityLabel={t('village.join')}
              className="bg-primary rounded-lg p-3 items-center"
            >
              <Text tone="onAccent">{user ? t('village.join') : t('village.signInToJoin')}</Text>
            </Pressable>
          </VStack>
        ) : null}

        {/* ── No organizer yet (wiki phase) ─────────────────────── */}
        {noOrganizer ? (
          <View className="mx-4 mt-3 p-3 rounded-lg border border-subtle bg-surface">
            <Text variant="bodySm">{t('village.noOrganizer.body')}</Text>
            {pendingOrganizerRequest ? (
              <Text tone="muted" variant="bodySm" className="mt-1">
                {t('village.noOrganizer.pending')}
              </Text>
            ) : (
              <Pressable
                onPress={() => router.push(`/discover/organize/${village.id}` as never)}
                className="mt-2 flex-row items-center"
              >
                <Ionicons name="ribbon-outline" size={16} color={ACCENT} />
                <Text variant="bodySm" style={{ color: ACCENT }} className="ml-1 font-medium">
                  {t('village.noOrganizer.cta')}
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {/* ── Stats ────────────────────────────────────────────── */}
        <HStack className="items-center justify-center py-5">
          <Stat value={peopleCount} label={t('village.admin.overview.people')} />
          <StatSeparator />
          <Stat value={penas.length} label={t('village.hub.penas')} />
          <StatSeparator />
          <Stat value={places.length} label={t('village.admin.hub.places')} />
        </HStack>

        {/* ── Compartir / Invitar (everyone) ───────────────────── */}
        <HStack gap={3} className="px-4 pb-2">
          <Pressable
            onPress={() => void share(getVillageViewLink(village.id), village.name)}
            accessibilityLabel={t('village.share.title')}
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
              {t('village.share.title')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void share(getVillageInviteLink(village.id), village.name)}
            accessibilityLabel={t('village.invite.title')}
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
              {t('village.invite.title')}
            </Text>
          </Pressable>
        </HStack>

        {/* ── Próximos eventos ─────────────────────────────────── */}
        <Section
          title={t('village.upcomingEvents.title')}
          isEmpty={events.length === 0}
          emptyLabel={t('village.upcomingEvents.empty')}
        >
          {events.map((e) => (
            <EntityCard
              key={e.id}
              label={e.title}
              sub={formatDate(e.startDate, 'short')}
              icon="calendar-outline"
              imageUri={e.imageURL ?? e.municipalityCoverImage}
              onPress={() => router.push(`/event/${e.id}` as never)}
            />
          ))}
        </Section>

        {/* ── Barrios ──────────────────────────────────────────── */}
        <Section
          title={t('village.admin.hub.barrios')}
          isEmpty={visibleBarrios.length === 0}
          emptyLabel={t('village.admin.barrios.empty')}
          addLabel={canManage ? t('village.admin.barrios.add') : t('village.proposals.propose')}
          onAdd={() => router.push(`${villageBase}/barrios` as never)}
        >
          {visibleBarrios.map((b) => (
            <EntityCard
              key={b.id}
              label={b.name}
              sub={b.status === 'pending' ? t('village.proposals.pending') : undefined}
              icon="map-outline"
              imageUri={b.imageURL}
              onPress={() => router.push(`/village/${village.id}/barrio/${b.id}` as never)}
            />
          ))}
        </Section>

        {/* ── Lugares ──────────────────────────────────────────── */}
        <Section
          title={t('village.admin.hub.places')}
          isEmpty={visiblePlaces.length === 0}
          emptyLabel={t('village.admin.places.empty')}
          addLabel={canManage ? t('village.admin.places.add') : t('village.proposals.propose')}
          onAdd={() => router.push(`${villageBase}/places` as never)}
        >
          {visiblePlaces.map((p) => (
            <EntityCard
              key={p.id}
              label={p.name}
              sub={p.status === 'pending' ? t('village.proposals.pending') : undefined}
              icon="location-outline"
              imageUri={p.imageURL}
              onPress={() => router.push(`/village/${village.id}/place/${p.id}` as never)}
            />
          ))}
        </Section>

        {/* ── Agrupaciones (ayuntamiento + asociación) ─────────── */}
        <Section
          title={t('village.hub.organizations')}
          onManage={() => router.push(`${villageBase}/organizations` as never)}
          isEmpty={agrupaciones.length === 0}
          emptyLabel={t('village.organizationsList.empty')}
          addLabel={canManage ? t('village.admin.organizations.add') : t('village.proposals.propose')}
          onAdd={() => router.push(`${villageBase}/organizations` as never)}
        >
          {agrupaciones.map((o) => (
            <EntityCard
              key={o.id}
              label={o.name}
              sub={t('village.hub.memberCount', { count: orgMemberCounts[o.id] ?? 0 })}
              icon="business-outline"
              imageUri={o.imageURL}
              onPress={() => router.push(`/o/${o.id}` as never)}
            />
          ))}
        </Section>

        {/* ── Peñas ────────────────────────────────────────────── */}
        <Section
          title={t('village.hub.penas')}
          onManage={() => router.push(`${villageBase}/organizations` as never)}
          isEmpty={penas.length === 0}
          emptyLabel={t('village.organizationsList.penasEmpty')}
          addLabel={canManage ? t('village.admin.organizations.add') : t('village.proposals.propose')}
          onAdd={() => router.push(`${villageBase}/organizations` as never)}
        >
          {penas.map((o) => (
            <EntityCard
              key={o.id}
              label={o.name}
              sub={t('village.hub.memberCount', { count: orgMemberCounts[o.id] ?? 0 })}
              icon="people-circle-outline"
              imageUri={o.imageURL}
              onPress={() => router.push(`/o/${o.id}` as never)}
            />
          ))}
        </Section>

        {/* ── Censo (everyone) ─────────────────────────────────── */}
        <View className="px-4 pt-6">
          <Button
            variant="secondary"
            onPress={() => router.push(`/village/${village.id}/censo` as never)}
          >
            {t('village.censo.link')}
          </Button>
        </View>
      </ScrollView>

      <VillageInfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        village={village}
        canManage={canManage}
      />
    </>
  );
}
