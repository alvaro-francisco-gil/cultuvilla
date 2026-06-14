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
  PersonCard,
  EntityCard,
  SettingsLink,
} from '../../components/feature/VillageSections';
import { useAuth } from '../../lib/auth/useAuth';
import { useIsAppAdmin } from '../../lib/auth/useIsAppAdmin';
import { useT } from '../../lib/i18n';
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
import { getMyOrganizerRequests } from '@cultuvilla/shared/services/organizerRequestService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';
import {
  escudoFullUrl,
  hasManualEscudo,
} from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { BarrioData, PlaceData } from '@cultuvilla/shared/models/municipality';
import type { OrganizationData } from '@cultuvilla/shared/models/organization';

type Village = MunicipalityData & { id: string };
type Barrio = BarrioData & { id: string };
type Place = PlaceData & { id: string };
type Organization = OrganizationData & { id: string };

/** A person shown in the "Personas" scroll — either a member or a pending join request. */
type Person = {
  userId: string;
  name: string;
  photoURL: string | null;
  isRequest: boolean;
};

/** Cap profile look-ups for the horizontal scroll; "Gestionar" opens the full list. */
const PEOPLE_LIMIT = 20;

export default function VillageTabScreen() {
  const { user, profile, profileChecked } = useAuth();
  const { t } = useT();
  const { isAppAdmin } = useIsAppAdmin();
  const [village, setVillage] = useState<Village | null>(null);
  const [villageAdmin, setVillageAdmin] = useState(false);
  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
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
      setPeople([]);
      setPeopleCount(0);
      setPendingOrganizerRequest(false);
      setLoadError(null);
      return;
    }
    try {
      const [mun, isAdmin, myReqs, bar, plc, members] = await Promise.all([
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

      // Pending requests come first, then members; resolve display name + photo.
      const pending = requests.map((r) => ({ userId: r.userId, isRequest: true }));
      const joined = members
        .slice(0, PEOPLE_LIMIT)
        .map((m) => ({ userId: m.userId, isRequest: false }));
      const resolved = await Promise.all(
        [...pending, ...joined].map(async (p) => {
          const prof = await getUserProfile(p.userId);
          return {
            userId: p.userId,
            name: prof?.displayName ?? p.userId,
            photoURL: prof?.photoURL ?? null,
            isRequest: p.isRequest,
          };
        }),
      );

      setVillage(mun);
      setVillageAdmin(isAdmin);
      setBarrios(bar);
      setPlaces(plc);
      setOrganizations(orgs);
      setPeople(resolved);
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
  const base = `/village/${village.id}/admin` as const;
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
              onPress={() => router.push(`${base}/community` as never)}
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

        {/* ── Personas (members + pending join requests for admins) ─ */}
        <Section
          title={t('village.admin.overview.people')}
          onManage={canManage ? () => router.push(`${base}/requests` as never) : undefined}
          isEmpty={people.length === 0}
          emptyLabel={t('village.admin.overview.noPeople')}
        >
          {people.map((p) =>
            p.isRequest ? (
              <PersonCard
                key={`req-${p.userId}`}
                name={p.name}
                photoURL={p.photoURL}
                badge={t('village.admin.overview.requestBadge')}
                onPress={() => router.push(`${base}/requests` as never)}
              />
            ) : (
              <PersonCard key={`mem-${p.userId}`} name={p.name} photoURL={p.photoURL} />
            ),
          )}
        </Section>

        {/* ── Barrios ──────────────────────────────────────────── */}
        <Section
          title={t('village.admin.hub.barrios')}
          onManage={canManage ? () => router.push(`${base}/barrios` as never) : undefined}
          isEmpty={barrios.length === 0}
          emptyLabel={t('village.admin.barrios.empty')}
          addLabel={canManage ? t('village.admin.barrios.add') : undefined}
          onAdd={canManage ? () => router.push(`${base}/barrios` as never) : undefined}
        >
          {barrios.map((b) => (
            <EntityCard
              key={b.id}
              label={b.name}
              icon="map-outline"
              onPress={canManage ? () => router.push(`${base}/barrios` as never) : undefined}
            />
          ))}
        </Section>

        {/* ── Lugares ──────────────────────────────────────────── */}
        <Section
          title={t('village.admin.hub.places')}
          onManage={canManage ? () => router.push(`${base}/places` as never) : undefined}
          isEmpty={places.length === 0}
          emptyLabel={t('village.admin.places.empty')}
          addLabel={canManage ? t('village.admin.places.add') : undefined}
          onAdd={canManage ? () => router.push(`${base}/places` as never) : undefined}
        >
          {places.map((p) => (
            <EntityCard
              key={p.id}
              label={p.name}
              sub={t(`village.admin.places.kind.${p.kind}`)}
              icon="location-outline"
              onPress={canManage ? () => router.push(`${base}/places` as never) : undefined}
            />
          ))}
        </Section>

        {/* ── Agrupaciones (ayuntamiento + asociación) ─────────── */}
        <Section
          title={t('village.hub.organizations')}
          onManage={canManage ? () => router.push(`${base}/organizations` as never) : undefined}
          isEmpty={agrupaciones.length === 0}
          emptyLabel={t('village.organizationsList.empty')}
          addLabel={canManage ? t('village.admin.organizations.add') : undefined}
          onAdd={canManage ? () => router.push(`${base}/organizations` as never) : undefined}
        >
          {agrupaciones.map((o) => (
            <EntityCard
              key={o.id}
              label={o.name}
              sub={canManage ? o.status : undefined}
              icon="business-outline"
              onPress={canManage ? () => router.push(`${base}/organizations` as never) : undefined}
            />
          ))}
        </Section>

        {/* ── Peñas ────────────────────────────────────────────── */}
        <Section
          title={t('village.hub.penas')}
          onManage={canManage ? () => router.push(`${base}/organizations` as never) : undefined}
          isEmpty={penas.length === 0}
          emptyLabel={t('village.organizationsList.penasEmpty')}
          addLabel={canManage ? t('village.admin.organizations.add') : undefined}
          onAdd={canManage ? () => router.push(`${base}/organizations` as never) : undefined}
        >
          {penas.map((o) => (
            <EntityCard
              key={o.id}
              label={o.name}
              sub={canManage ? o.status : undefined}
              icon="people-circle-outline"
              onPress={canManage ? () => router.push(`${base}/organizations` as never) : undefined}
            />
          ))}
        </Section>

        {/* ── More settings (admins only) ──────────────────────── */}
        {canManage ? (
          <VStack gap={2} className="px-4 pt-4">
            <Text variant="h3" className="mb-1">
              {t('village.admin.overview.more')}
            </Text>
            <SettingsLink
              icon="link-outline"
              label={t('village.admin.hub.invites')}
              onPress={() => router.push(`${base}/invite-tokens` as never)}
            />
          </VStack>
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
