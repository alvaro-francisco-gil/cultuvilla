import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Image, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  VStack,
  HStack,
  Text,
  Pressable,
  Escudo,
} from '../../../../components/primitives';
import {
  ACCENT,
  Stat,
  StatSeparator,
  Section,
  PersonCard,
  EntityCard,
  SettingsLink,
} from '../../../../components/feature/VillageSections';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import {
  getMunicipality,
  getBarrios,
  getPlaces,
} from '@cultuvilla/shared/services/municipalityService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { getVillageMembers } from '@cultuvilla/shared/services/villageMemberService';
import { getJoinRequestsForVillage } from '@cultuvilla/shared/services/joinRequestService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';
import { escudoFullUrl } from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { BarrioData, PlaceData } from '@cultuvilla/shared/models/municipality';
import type { OrganizationData } from '@cultuvilla/shared/models/organization';

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

export default function VillageAdminHub() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const base = `/village/${villageId}/admin` as const;

  const [village, setVillage] = useState<MunicipalityData | null>(null);
  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!villageId) return;
    const [mun, bar, plc, orgs, members, requests] = await Promise.all([
      getMunicipality(villageId),
      getBarrios(villageId),
      getPlaces(villageId),
      getOrganizationsByMunicipality(villageId),
      getVillageMembers(villageId),
      getJoinRequestsForVillage(villageId, 'pending'),
    ]);
    setVillage(mun);
    setBarrios(bar);
    setPlaces(plc);
    setOrganizations(orgs);

    // Pending requests come first, then members; resolve display name + photo.
    const pending = requests.map((r) => ({ userId: r.userId, isRequest: true }));
    const joined = members.slice(0, PEOPLE_LIMIT).map((m) => ({ userId: m.userId, isRequest: false }));
    const resolved = await Promise.all(
      [...pending, ...joined].map(async (p) => {
        const profile = await getUserProfile(p.userId);
        return {
          userId: p.userId,
          name: profile?.displayName ?? p.userId,
          photoURL: profile?.photoURL ?? null,
          isRequest: p.isRequest,
        };
      }),
    );
    setPeople(resolved);
    setLoading(false);
  }, [villageId]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const cover = village?.community?.coverImages?.[0] ?? null;
  const description = village?.community?.description?.trim();

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.title')} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerClassName="pb-10">
          {/* ── Hero ─────────────────────────────────────────────── */}
          <View>
            {cover ? (
              <Image source={{ uri: cover }} className="w-full h-56" resizeMode="cover" />
            ) : null}
            {/* With a cover, edit floats top-right over the image; without one
                there's nothing to float on, so it falls back to an inline link
                below the name (see end of this block). */}
            {cover ? (
              <Pressable
                onPress={() => router.push(`${base}/community` as never)}
                accessibilityLabel={t('village.admin.overview.edit')}
                className="absolute right-3 top-3 flex-row items-center bg-surface rounded-full px-3 py-1.5 shadow-sm"
              >
                <Ionicons name="create-outline" size={16} color={ACCENT} />
                <Text variant="bodySm" style={{ color: ACCENT }} className="ml-1 font-medium">
                  {t('village.admin.overview.edit')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <VStack gap={1} className={`items-center px-4 ${cover ? '-mt-12' : 'pt-4'}`}>
            <View className="bg-surface rounded-2xl p-2 shadow-sm">
              <Escudo
                url={village ? escudoFullUrl(village) : null}
                size={96}
                fallbackInitial={village?.name}
              />
            </View>
            <Text variant="h2" className="mt-3 text-center">
              {village?.name}
            </Text>
            <Text tone="muted" variant="bodySm">
              {village?.province}
            </Text>
            <Text
              tone="muted"
              variant="bodySm"
              className="text-center mt-1"
              numberOfLines={4}
            >
              {description || t('village.admin.overview.noDescription')}
            </Text>
            {!cover ? (
              <Pressable
                onPress={() => router.push(`${base}/community` as never)}
                accessibilityLabel={t('village.admin.overview.edit')}
                className="flex-row items-center mt-2"
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
            <Stat value={barrios.length} label={t('village.admin.hub.barrios')} />
            <StatSeparator />
            <Stat value={places.length} label={t('village.admin.hub.places')} />
            <StatSeparator />
            <Stat value={organizations.length} label={t('village.admin.hub.organizations')} />
          </HStack>

          {/* ── Personas (members + pending join requests) ───────── */}
          <Section
            title={t('village.admin.overview.people')}
            onManage={() => router.push(`${base}/requests` as never)}
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
            onManage={() => router.push(`${base}/barrios` as never)}
            isEmpty={barrios.length === 0}
            emptyLabel={t('village.admin.barrios.empty')}
            addLabel={t('village.admin.barrios.add')}
            onAdd={() => router.push(`${base}/barrios` as never)}
          >
            {barrios.map((b) => (
              <EntityCard
                key={b.id}
                label={b.name}
                icon="map-outline"
                onPress={() => router.push(`${base}/barrios` as never)}
              />
            ))}
          </Section>

          {/* ── Lugares ──────────────────────────────────────────── */}
          <Section
            title={t('village.admin.hub.places')}
            onManage={() => router.push(`${base}/places` as never)}
            isEmpty={places.length === 0}
            emptyLabel={t('village.admin.places.empty')}
            addLabel={t('village.admin.places.add')}
            onAdd={() => router.push(`${base}/places` as never)}
          >
            {places.map((p) => (
              <EntityCard
                key={p.id}
                label={p.name}
                sub={t(`village.admin.places.kind.${p.kind}`)}
                icon="location-outline"
                onPress={() => router.push(`${base}/places` as never)}
              />
            ))}
          </Section>

          {/* ── Organizaciones ───────────────────────────────────── */}
          <Section
            title={t('village.admin.hub.organizations')}
            onManage={() => router.push(`${base}/organizations` as never)}
            isEmpty={organizations.length === 0}
            emptyLabel={t('village.admin.overview.organizationsEmpty')}
            addLabel={t('village.admin.organizations.add')}
            onAdd={() => router.push(`${base}/organizations` as never)}
          >
            {organizations.map((o) => (
              <EntityCard
                key={o.id}
                label={o.name}
                sub={o.status}
                icon="business-outline"
                onPress={() => router.push(`${base}/organizations` as never)}
              />
            ))}
          </Section>

          {/* ── More settings ────────────────────────────────────── */}
          <VStack gap={2} className="px-4 pt-4">
            <Text variant="h3" className="mb-1">
              {t('village.admin.overview.more')}
            </Text>
            <SettingsLink
              icon="list-outline"
              label={t('village.admin.hub.censo')}
              onPress={() => router.push(`${base}/censo` as never)}
            />
            <SettingsLink
              icon="link-outline"
              label={t('village.admin.hub.invites')}
              onPress={() => router.push(`${base}/invite-tokens` as never)}
            />
          </VStack>
        </ScrollView>
      )}
    </Screen>
  );
}
