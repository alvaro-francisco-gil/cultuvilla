import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View, Image, Linking } from 'react-native';
import { router } from 'expo-router';
import {
  Text,
  VStack,
  HStack,
  Pressable,
  Escudo,
  Button,
  ScreenTitle,
  ErrorState,
} from '../primitives';
import { ACCENT, Section, EntityCard } from './VillageSections';
import { AddContentSheet } from './AddContentSheet';
import { JoinVillageModal } from './JoinVillageModal';
import { StatsRow } from './StatsRow';
import { useAuth } from '../../lib/auth/useAuth';
import { useRegisterGate } from '../../lib/auth/RegisterGateContext';
import { useIsAppAdmin } from '../../lib/auth/useIsAppAdmin';
import { useShareDeepLink } from '../../lib/deeplink/useShareDeepLink';
import { useT } from '../../lib/i18n';
import { showConfirm } from '../../lib/dialogs';
import { isProposalVisible } from '../../lib/proposals';
import { joinVillage } from '@cultuvilla/shared/services/villageMemberService';
import { getVillageViewLink } from '@cultuvilla/shared/services/deepLinkService';
import { staticMapUrl, MAP_ZOOM_DEFAULT } from '@cultuvilla/shared/services/mapsService';
import { newsImageDownloadURL } from '@cultuvilla/shared/services/imageService';
import type { NewsPostData } from '@cultuvilla/shared/models/news/NewsPostDataModel';
import { formatDate, formatFestivalPosterDates } from '@cultuvilla/shared/utils';
import {
  escudoFullUrl,
  hasManualEscudo,
} from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { VillageHomeState } from '../../lib/useVillageHome';

export interface VillageHomeBodyProps {
  data: VillageHomeState;
  reload: () => Promise<void> | void;
}

/**
 * Presentational village home shared by the pueblo tab and the pushed
 * `/village/[villageId]` detail. Takes data from `useVillageHome`; the host
 * supplies the header chrome (AppHeader vs ScreenHeader). The action row's first
 * button is "Unirme" (join) for non-members and "Añadir contenido" (opens the
 * add sheet) for members; `!data.isMember` is the single source of truth for
 * "offer to join". Editar (admins) and Compartir (everyone) follow it.
 */
export function VillageHomeBody({ data, reload }: VillageHomeBodyProps) {
  const { user, refreshProfile } = useAuth();
  const gate = useRegisterGate();
  const { isAppAdmin } = useIsAppAdmin();
  const share = useShareDeepLink();
  const { t } = useT();
  const [joining, setJoining] = useState(false);
  const [pendingJoin, setPendingJoin] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const { coreLoading, coreError, village } = data;

  if (coreLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  if (coreError) {
    return <ErrorState error={coreError} onRetry={reload} />;
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
    barrioResidentCounts,
    events,
    news,
    festivalPosters,
    peopleCount,
    pendingOrganizerRequest,
    sectionStatus,
  } = data;
  const canManage = isAppAdmin || villageAdmin;
  // Wiki phase: active but no organizer granted yet (community.organizerId null).
  const noOrganizer = village.community?.organizerId == null;
  const villageBase = `/village/${village.id}` as const;

  const caps = { canManage, uid: user?.uid ?? null };
  // Barrios/places already come back active-only from useVillageHome (see
  // getBarrios/getPlaces) — the optimistic-visibility model means there's no
  // pending state left to filter here. Organizations keep the real
  // pending/approved/rejected review flow, so they still need the filter.
  const visibleOrgs = organizations.filter((o) => isProposalVisible(o.status, o.requestedBy, caps));
  const penas = visibleOrgs.filter((o) => o.type === 'peña');
  const agrupaciones = visibleOrgs.filter((o) => o.type !== 'peña');

  // Censo CTA label: "Editar censo" once every current question has a non-empty
  // answer; "Rellenar censo" otherwise. A newly-added (still-unanswered)
  // question therefore flips the label back to "Rellenar".
  const censoFields = village.community?.profileForm?.fields ?? [];
  const isAnswered = (v: unknown): boolean =>
    Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== '';
  const censoFilled =
    censoFields.length > 0 && censoFields.every((f) => isAnswered(data.myCensoAnswers[f.key]));
  const censoFillLabel = censoFilled ? t('village.censo.edit') : t('village.censo.fill');

  const openDirections = () => {
    const c = village.coordinates;
    if (!c) return;
    showConfirm(
      t('village.location.openMapsTitle'),
      '',
      () => {
        void Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`,
        ).catch(() => {
          /* best-effort */
        });
      },
      { confirmText: t('village.location.open') },
    );
  };

  const onJoin = () => {
    if (!user) {
      // Carry this village across auth: after the guest registers, onboarding
      // pre-selects it and joins them; an already-onboarded user resumes to it.
      gate.requireAuth(villageBase, t('guest.village'), village.id);
      return;
    }
    // Open the shared modal (escudo + name + barrio picker). Replaces the old
    // Alert.alert / window.confirm path, which is a no-op on web and could not
    // host the barrio picker.
    setPendingJoin(true);
  };

  const doJoin = async (barrioId: string | null) => {
    if (!user) return;
    setJoining(true);
    try {
      await joinVillage(village.id, user.uid, barrioId);
      setPendingJoin(false);
      // joinVillage set this village as active; refresh the auth profile so the
      // Pueblo tab reflects it now, not only after an app restart.
      await refreshProfile();
      await reload();
    } finally {
      setJoining(false);
    }
  };

  return (
    <>
      <ScrollView contentContainerClassName="pb-10">
        {/* ── Header (escudo + name) ───────────────────────────── */}
        <VStack gap={2} className="px-4 pt-4">
          <HStack gap={4} className="items-center">
            <View
              className={`bg-surface rounded-full overflow-hidden ${hasManualEscudo(village) ? '' : 'p-2'}`}
            >
              <Escudo
                url={escudoFullUrl(village)}
                size={88}
                fill={hasManualEscudo(village)}
                fallbackInitial={village.name}
              />
            </View>
            <VStack gap={0} className="flex-1">
              <ScreenTitle>{village.name}</ScreenTitle>
              <Text tone="muted" variant="bodySm">
                {village.province}
              </Text>
            </VStack>
          </HStack>
        </VStack>

        {/* ── Stats ────────────────────────────────────────────── */}
        <View className="px-4 pt-4 pb-4">
          <StatsRow
            stats={[
              {
                label: t('village.admin.overview.people'),
                value: peopleCount,
                onPress: isMember
                  ? () => router.push(`/village/${village.id}/members` as never)
                  : undefined,
              },
              {
                label: t('village.hub.organizations'),
                value: sectionStatus.organizations === 'ready' ? visibleOrgs.length : null,
              },
              {
                label: t('village.admin.hub.places'),
                value: sectionStatus.places === 'ready' ? places.length : null,
              },
            ]}
          />
        </View>

        {/* ── slot 1: Unirme (non-members) / Añadir contenido (members)
            + Editar (admins) + Compartir (everyone) ─────────────── */}
        <HStack gap={3} className="px-4 pt-2 pb-2">
          {!isMember ? (
            <ActionPill
              label={user ? t('village.join') : t('village.signInToJoin')}
              onPress={onJoin}
              disabled={joining}
            />
          ) : null}
          {isMember ? (
            <ActionPill
              label={t('village.addContent.button')}
              onPress={() => setAddOpen(true)}
            />
          ) : null}
          <ActionPill
            label={t('village.share.title')}
            onPress={() => void share(getVillageViewLink(village.id), village.name)}
          />
        </HStack>

        {/* ── No organizer yet (wiki phase) ─────────────────────── */}
        {noOrganizer ? (
          <VStack gap={2} className="px-4 pt-2">
            {pendingOrganizerRequest ? (
              <Pressable
                disabled
                onPress={() => {}}
                accessibilityLabel={t('village.noOrganizer.pending')}
                accessibilityState={{ disabled: true }}
                className="flex-row items-center justify-center bg-surface"
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 12,
                  borderRadius: 24,
                  borderWidth: 1.5,
                  borderColor: ACCENT,
                  minHeight: 32,
                  opacity: 0.5,
                }}
              >
                <Text style={{ color: ACCENT }} className="font-semibold">
                  {t('village.noOrganizer.pending')}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push(`/discover/organize/${village.id}` as never)}
                accessibilityLabel={t('village.noOrganizer.cta')}
                className="flex-row items-center justify-center bg-surface"
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
                  {t('village.noOrganizer.cta')}
                </Text>
              </Pressable>
            )}
            <Text variant="bodySm" className="text-center">
              {t('village.noOrganizer.body')}
            </Text>
          </VStack>
        ) : null}

        {/* ── Ubicación: the map rectangle when coordinates are set. When
            missing, the slot is hidden entirely — location is set in the
            edit-village ("Detalles") step, not from here. ── */}
        {village.coordinates ? (
          <View className="px-4 pt-2">
            <Pressable
              onPress={openDirections}
              accessibilityLabel={t('village.location.openMapsTitle')}
            >
              <Image
                source={{
                  uri: staticMapUrl(village.coordinates.lat, village.coordinates.lng, {
                    zoom: village.mapZoom ?? MAP_ZOOM_DEFAULT,
                    w: 640,
                    h: 256,
                  }),
                }}
                style={{ width: '100%', aspectRatio: 2.5, borderRadius: 16 }}
                resizeMode="cover"
              />
            </Pressable>
          </View>
        ) : null}

        {/* ── Eventos ──────────────────────────────────────────── */}
        <Section
          title={t('village.events.label')}
          isEmpty={events.length === 0}
          status={sectionStatus.events}
          data={events}
          keyExtractor={(e) => e.id}
          renderItem={({ item: e }) => (
            <EntityCard
              label={e.title}
              sub={formatDate(e.startDate, 'short')}
              icon="calendar-outline"
              imageUri={e.imageURL ?? e.villageCoverImage}
              onPress={() => router.push(`/event/${e.id}` as never)}
            />
          )}
        />

        {/* ── Artículos ────────────────────────────────────────── */}
        <Section
          title={t('village.newsFeed.title')}
          isEmpty={news.length === 0}
          status={sectionStatus.news}
        >
          {news.map((n) => (
            <NewsEntityCard
              key={n.id}
              post={n}
              onPress={() => router.push(`/news/${n.id}` as never)}
            />
          ))}
        </Section>

        {/* ── Carteles de fiestas ──────────────────────────────── */}
        <Section
          title={t('village.festivalPosters.title')}
          isEmpty={festivalPosters.length === 0}
          status={sectionStatus.festivalPosters}
        >
          {festivalPosters.map((p) => (
            <EntityCard
              key={p.id}
              label={String(p.year)}
              sub={[p.title, formatFestivalPosterDates(p)].filter(Boolean).join(' · ') || undefined}
              icon="image-outline"
              imageUri={p.images[0] ?? null}
              commentCount={p.commentCount}
              onPress={() => router.push(`${villageBase}/festival-poster/${p.id}` as never)}
            />
          ))}
        </Section>

        {/* ── Barrios ──────────────────────────────────────────── */}
        <Section
          title={t('village.admin.hub.barrios')}
          isEmpty={barrios.length === 0}
          status={sectionStatus.barrios}
        >
          {barrios.map((b) => (
            <EntityCard
              key={b.id}
              label={b.name}
              sub={t('village.admin.barrios.residentCount', {
                count: barrioResidentCounts[b.id] ?? 0,
              })}
              icon="map-outline"
              imageUri={b.imageURL}
              commentCount={b.commentCount}
              onPress={() => router.push(`/village/${village.id}/barrio/${b.id}` as never)}
            />
          ))}
        </Section>

        {/* ── Lugares ──────────────────────────────────────────── */}
        <Section
          title={t('village.admin.hub.places')}
          isEmpty={places.length === 0}
          status={sectionStatus.places}
        >
          {places.map((p) => (
            <EntityCard
              key={p.id}
              label={p.name}
              icon="location-outline"
              imageUri={p.imageURL}
              commentCount={p.commentCount}
              onPress={() => router.push(`/village/${village.id}/place/${p.id}` as never)}
            />
          ))}
        </Section>

        {/* ── Agrupaciones (ayuntamiento + asociación) ─────────── */}
        <Section
          title={t('village.hub.organizations')}
          isEmpty={agrupaciones.length === 0}
          status={sectionStatus.organizations}
        >
          {agrupaciones.map((o) => (
            <EntityCard
              key={o.id}
              label={o.name}
              sub={t('village.hub.memberCount', { count: orgMemberCounts[o.id] ?? 0 })}
              icon="business-outline"
              imageUri={o.imageURL}
              commentCount={o.commentCount}
              onPress={() => router.push(`/o/${o.id}` as never)}
            />
          ))}
        </Section>

        {/* ── Peñas ────────────────────────────────────────────── */}
        <Section
          title={t('village.hub.penas')}
          isEmpty={penas.length === 0}
          status={sectionStatus.organizations}
        >
          {penas.map((o) => (
            <EntityCard
              key={o.id}
              label={o.name}
              sub={t('village.hub.memberCount', { count: orgMemberCounts[o.id] ?? 0 })}
              icon="people-circle-outline"
              imageUri={o.imageURL}
              commentCount={o.commentCount}
              onPress={() => router.push(`/o/${o.id}` as never)}
            />
          ))}
        </Section>

        {/* ── Censo: only villagers of this village fill; admins also configure ─── */}
        {isMember || canManage ? (
          <HStack gap={3} className="px-4 pt-8">
            {isMember ? (
              <Pressable
                onPress={() => router.push(`/village/${village.id}/censo?mode=fill` as never)}
                accessibilityLabel={censoFillLabel}
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
                  {censoFillLabel}
                </Text>
              </Pressable>
            ) : null}
            {canManage ? (
              <Pressable
                onPress={() => router.push(`/village/${village.id}/censo?mode=configure` as never)}
                accessibilityLabel={t('village.censo.configure')}
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
                  {t('village.censo.configure')}
                </Text>
              </Pressable>
            ) : null}
          </HStack>
        ) : null}
      </ScrollView>
      <JoinVillageModal
        municipality={
          pendingJoin
            ? {
                id: village.id,
                name: village.name,
                escudoUrl: escudoFullUrl(village),
                escudoFill: hasManualEscudo(village),
              }
            : null
        }
        busy={joining}
        onCancel={() => setPendingJoin(false)}
        onConfirm={(barrioId) => void doJoin(barrioId)}
      />
      <AddContentSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        villageId={village.id}
        canManage={canManage}
      />
    </>
  );
}

/** The terracotta-outline pill used across the village-home action row. */
function ActionPill({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
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
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * News card for the village-home horizontal scroll. News images are Storage
 * paths (not plain URLs like events), so resolve the first one asynchronously
 * before handing it to <EntityCard>; falls back to the newspaper icon.
 */
function NewsEntityCard({
  post,
  onPress,
}: {
  post: NewsPostData & { id: string };
  onPress: () => void;
}) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const firstImagePath = post.coverImage?.storagePath ?? post.images[0]?.storagePath ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!firstImagePath) {
      setImageUri(null);
      return;
    }
    newsImageDownloadURL(firstImagePath)
      .then((url) => {
        if (!cancelled) setImageUri(url);
      })
      .catch(() => {
        if (!cancelled) setImageUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [firstImagePath]);

  return (
    <EntityCard
      label={post.title}
      sub={formatDate(post.publishedAt ?? post.createdAt, 'short')}
      icon="newspaper-outline"
      imageUri={imageUri}
      onPress={onPress}
    />
  );
}
