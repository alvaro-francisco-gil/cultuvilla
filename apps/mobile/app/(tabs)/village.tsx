import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, VStack, HStack, Pressable, Escudo, Button } from '../../components/primitives';
import { AppHeader } from '../../components/layout/AppHeader';
import { VillageDiscovery } from '../../components/feature/VillageDiscovery';
import {
  ACCENT,
  Stat,
  StatSeparator,
  Section,
  EntityCard,
  SettingsLink,
} from '../../components/feature/VillageSections';
import { useAuth } from '../../lib/auth/useAuth';
import { useIsAppAdmin } from '../../lib/auth/useIsAppAdmin';
import { useShareDeepLink } from '../../lib/deeplink/useShareDeepLink';
import { useT } from '../../lib/i18n';
import {
  getVillageViewLink,
  getVillageInviteLink,
} from '@cultuvilla/shared/services/deepLinkService';
import { withFirestoreErrorLog } from '../../lib/firestoreErrorLog';
import {
  getMunicipality,
  getBarrios,
  getPlaces,
  updateMunicipality,
} from '@cultuvilla/shared/services/municipalityService';
import { uploadMunicipalityImage } from '@cultuvilla/shared/services/imageService';
import { pickImageAsBlob } from '../../lib/images';
import {
  isVillageAdmin,
  getVillageMembers,
} from '@cultuvilla/shared/services/villageMemberService';
import { getJoinRequestsForVillage } from '@cultuvilla/shared/services/joinRequestService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { getOrgMemberCount } from '@cultuvilla/shared/services/orgMemberService';
import { getMyOrganizerRequests } from '@cultuvilla/shared/services/organizerRequestService';
import { getEventsByMunicipality } from '@cultuvilla/shared/services/eventService';
import { formatDate } from '@cultuvilla/shared/utils';
import {
  escudoFullUrl,
  hasManualEscudo,
} from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { BarrioData, PlaceData } from '@cultuvilla/shared/models/municipality';
import type { OrganizationData } from '@cultuvilla/shared/models/organization';
import type { EventData } from '@cultuvilla/shared/models/event';

type Village = MunicipalityData & { id: string };
type Barrio = BarrioData & { id: string };
type Place = PlaceData & { id: string };
type Organization = OrganizationData & { id: string };
type Event = EventData & { id: string };

export default function VillageTabScreen() {
  const { user, profile, profileChecked } = useAuth();
  const { t } = useT();
  const { isAppAdmin } = useIsAppAdmin();
  const share = useShareDeepLink();
  const [village, setVillage] = useState<Village | null>(null);
  const [villageAdmin, setVillageAdmin] = useState(false);
  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgMemberCounts, setOrgMemberCounts] = useState<Record<string, number>>({});
  const [events, setEvents] = useState<Event[]>([]);
  const [peopleCount, setPeopleCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingOrganizerRequest, setPendingOrganizerRequest] = useState(false);
  const [uploadingEscudo, setUploadingEscudo] = useState(false);

  const activeMunicipalityId = profile?.activeMunicipalityId ?? null;

  const loadVillage = useCallback(async () => {
    if (!activeMunicipalityId) {
      setVillage(null);
      setVillageAdmin(false);
      setBarrios([]);
      setPlaces([]);
      setOrganizations([]);
      setOrgMemberCounts({});
      setEvents([]);
      setPeopleCount(0);
      setPendingOrganizerRequest(false);
      setLoadError(null);
      return;
    }
    try {
      const [mun, isAdmin, myReqs, bar, plc, members, evts] = await Promise.all([
        withFirestoreErrorLog('village:getMunicipality', () =>
          getMunicipality(activeMunicipalityId),
        ),
        user
          ? withFirestoreErrorLog('village:isVillageAdmin', () =>
              isVillageAdmin(activeMunicipalityId, user.uid),
            )
          : Promise.resolve(false),
        user
          ? withFirestoreErrorLog('village:getMyOrganizerRequests', () =>
              getMyOrganizerRequests(user.uid),
            )
          : Promise.resolve([]),
        withFirestoreErrorLog('village:getBarrios', () => getBarrios(activeMunicipalityId)),
        withFirestoreErrorLog('village:getPlaces', () => getPlaces(activeMunicipalityId)),
        withFirestoreErrorLog('village:getVillageMembers', () =>
          getVillageMembers(activeMunicipalityId),
        ),
        withFirestoreErrorLog('village:getEvents', () =>
          getEventsByMunicipality(activeMunicipalityId, 'published'),
        ),
      ]);

      const canManageNow = isAppAdmin || isAdmin;

      // Admins see every organization (incl. pending moderation); villagers
      // only see approved ones. Pending join requests are admin-only per rules.
      const [orgs, requests] = await Promise.all([
        withFirestoreErrorLog('village:getOrganizations', () =>
          getOrganizationsByMunicipality(
            activeMunicipalityId,
            canManageNow ? undefined : 'approved',
          ),
        ),
        canManageNow && user
          ? withFirestoreErrorLog('village:getJoinRequests', () =>
              getJoinRequestsForVillage(activeMunicipalityId, 'pending'),
            )
          : Promise.resolve([]),
      ]);

      // Only upcoming events; the service already orders them by startDate asc.
      const now = new Date();
      const upcoming = evts.filter((e) => e.startDate >= now);

      // People count shown on each agrupación/peña card — one server-side
      // aggregate per org, fanned out in parallel.
      const counts = await Promise.all(
        orgs.map((o) =>
          withFirestoreErrorLog('village:getOrgMemberCount', () => getOrgMemberCount(o.id)),
        ),
      );
      const countByOrg: Record<string, number> = {};
      orgs.forEach((o, i) => {
        countByOrg[o.id] = counts[i] ?? 0;
      });

      setVillage(mun);
      setVillageAdmin(isAdmin);
      setBarrios(bar);
      setPlaces(plc);
      setOrganizations(orgs);
      setOrgMemberCounts(countByOrg);
      setEvents(upcoming);
      setPeopleCount(members.length + requests.length);
      setPendingOrganizerRequest(
        myReqs.some(
          (r) => r.municipalityId === activeMunicipalityId && r.status === 'pending',
        ),
      );
      setLoadError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[VillageTab] loadVillage ERR', msg);
      setLoadError(msg);
    }
  }, [activeMunicipalityId, user, isAppAdmin]);

  useEffect(() => {
    void loadVillage();
  }, [loadVillage]);

  useFocusEffect(
    useCallback(() => {
      void loadVillage();
    }, [loadVillage]),
  );

  // Admin-only: pick an image, upload it, and store it as the manual escudo.
  // It lands in `escudoManualUrl` (not `escudoUrl`), which wins over the
  // Wikidata escudo at display time and survives `escudos:upload` re-runs.
  const changeEscudo = useCallback(async () => {
    if (!activeMunicipalityId) return;
    const picked = await pickImageAsBlob({ square: true });
    if (!picked) return;
    setUploadingEscudo(true);
    try {
      const url = await uploadMunicipalityImage(activeMunicipalityId, picked);
      await updateMunicipality(activeMunicipalityId, { escudoManualUrl: url });
      await loadVillage();
    } catch (e) {
      // mobile-web-compat: native-only — admin surface, not exercised on web
      Alert.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingEscudo(false);
    }
  }, [activeMunicipalityId, loadVillage]);

  // AuthGate already waits for `profileChecked`, but guard once more for safety.
  if (!profileChecked) {
    return (
      <Screen padded={false} topInset={false} bottomInset={false}>
        <AppHeader />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (!activeMunicipalityId) {
    return (
      <Screen padded={false} topInset={false} bottomInset={false}>
        <AppHeader />
        <VillageDiscovery />
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen padded={false} topInset={false} bottomInset={false}>
        <AppHeader />
        <View className="flex-1 items-center justify-center px-8">
          <Text tone="danger">{loadError}</Text>
        </View>
      </Screen>
    );
  }

  if (!village) {
    return (
      <Screen padded={false} topInset={false} bottomInset={false}>
        <AppHeader />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (!village.communityActive) {
    return (
      <Screen padded={false} topInset={false} bottomInset={false}>
        <AppHeader centerLabel={village.name} />
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
            {pendingOrganizerRequest ? (
              <Text tone="muted" className="text-center mt-4">
                {t('village.notRegistered.pending')}
              </Text>
            ) : (
              <Button
                className="mt-4"
                onPress={() =>
                  router.push(`/discover/request-organizer/${village.id}` as never)
                }
              >
                {t('village.notRegistered.button')}
              </Button>
            )}
          </VStack>
        </View>
      </Screen>
    );
  }

  const canManage = isAppAdmin || villageAdmin;
  // Member-accessible base for the shared propose-pending surfaces (barrios,
  // places, organizations, community, censo): any villager can open these to
  // propose; organizers manage there. The old /admin group was removed.
  const villageBase = `/village/${village.id}` as const;
  const cover = village.community?.coverImages?.[0] ?? null;
  const description = village.community?.description?.trim();

  // "Agrupaciones" groups ayuntamiento + asociación; peñas get their own scroll.
  const penas = organizations.filter((o) => o.type === 'peña');
  const agrupaciones = organizations.filter((o) => o.type !== 'peña');

  return (
    <Screen padded={false} topInset={false} bottomInset={false}>
      <AppHeader centerLabel={village.name} />
      <ScrollView contentContainerClassName="pb-10">
        {/* ── Hero ─────────────────────────────────────────────── */}
        {cover ? (
          <Image source={{ uri: cover }} className="w-full h-40" resizeMode="cover" />
        ) : null}
        {/* Content starts after the cover image — escudo + name sit below it,
            never overlapping the photo. */}
        <VStack gap={2} className="px-4 pt-4">
          <HStack gap={3} className="items-center">
            <Pressable
              onPress={changeEscudo}
              disabled={!canManage || uploadingEscudo}
              accessibilityLabel={
                canManage
                  ? escudoFullUrl(village)
                    ? t('village.escudo.change')
                    : t('village.escudo.add')
                  : undefined
              }
              className={`relative bg-surface rounded-2xl shadow-sm ${
                hasManualEscudo(village) ? '' : 'p-2'
              }`}
            >
              <Escudo
                url={escudoFullUrl(village)}
                size={88}
                fill={hasManualEscudo(village)}
                fallbackInitial={village.name}
              />
              {uploadingEscudo ? (
                <View className="absolute inset-0 items-center justify-center rounded-2xl bg-black/30">
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </Pressable>
            <VStack gap={0} className="flex-1">
              <Text variant="h1">{village.name}</Text>
              <Text tone="muted" variant="bodySm">
                {village.province}
              </Text>
            </VStack>
          </HStack>
          {description ? (
            <Text tone="muted" variant="bodySm">
              {description}
            </Text>
          ) : canManage ? (
            <Text tone="muted" variant="bodySm">
              {t('village.admin.overview.noDescription')}
            </Text>
          ) : null}
          {canManage ? (
            <Pressable
              onPress={() => router.push(`${villageBase}/community` as never)}
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

        {/* ── Stats ────────────────────────────────────────────── */}
        <HStack className="items-center justify-center py-5">
          <Stat value={peopleCount} label={t('village.admin.overview.people')} />
          <StatSeparator />
          <Stat value={penas.length} label={t('village.hub.penas')} />
          <StatSeparator />
          <Stat value={places.length} label={t('village.admin.hub.places')} />
        </HStack>

        {/* ── Compartir / Invitar ──────────────────────────────── */}
        {activeMunicipalityId ? (
          <HStack gap={3} className="px-4 pb-2">
            <Pressable
              onPress={() => void share(getVillageViewLink(activeMunicipalityId), village.name)}
              accessibilityLabel={t('village.share.title')}
              className="flex-1 flex-row items-center justify-center bg-surface"
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 24,
                borderWidth: 1.5,
                borderColor: ACCENT,
                minHeight: 36,
              }}
            >
              <Text style={{ color: ACCENT }} className="font-semibold">
                {t('village.share.title')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void share(getVillageInviteLink(activeMunicipalityId), village.name)}
              accessibilityLabel={t('village.invite.title')}
              className="flex-1 flex-row items-center justify-center bg-surface"
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 24,
                borderWidth: 1.5,
                borderColor: ACCENT,
                minHeight: 36,
              }}
            >
              <Text style={{ color: ACCENT }} className="font-semibold">
                {t('village.invite.title')}
              </Text>
            </Pressable>
          </HStack>
        ) : null}

        {/* ── Próximos eventos (upcoming published events, everyone) ─ */}
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
          onManage={() => router.push(`${villageBase}/barrios` as never)}
          isEmpty={barrios.length === 0}
          emptyLabel={t('village.admin.barrios.empty')}
          addLabel={canManage ? t('village.admin.barrios.add') : t('village.proposals.propose')}
          onAdd={() => router.push(`${villageBase}/barrios` as never)}
        >
          {barrios.map((b) => (
            <EntityCard
              key={b.id}
              label={b.name}
              sub={b.status === 'pending' ? t('village.proposals.pending') : undefined}
              icon="map-outline"
              imageUri={b.imageURL}
              onPress={() => router.push(`${villageBase}/barrios` as never)}
            />
          ))}
        </Section>

        {/* ── Lugares ──────────────────────────────────────────── */}
        <Section
          title={t('village.admin.hub.places')}
          onManage={() => router.push(`${villageBase}/places` as never)}
          isEmpty={places.length === 0}
          emptyLabel={t('village.admin.places.empty')}
          addLabel={canManage ? t('village.admin.places.add') : t('village.proposals.propose')}
          onAdd={() => router.push(`${villageBase}/places` as never)}
        >
          {places.map((p) => (
            <EntityCard
              key={p.id}
              label={p.name}
              sub={p.status === 'pending' ? t('village.proposals.pending') : undefined}
              icon="location-outline"
              imageUri={p.imageURL}
              onPress={() => router.push(`${villageBase}/places` as never)}
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
              onPress={() => router.push(`${villageBase}/organizations` as never)}
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
              onPress={() => router.push(`${villageBase}/organizations` as never)}
            />
          ))}
        </Section>

        {/* ── More settings (admins only) ──────────────────────── */}
        {canManage ? (
          null
        ) : null}

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
    </Screen>
  );
}
