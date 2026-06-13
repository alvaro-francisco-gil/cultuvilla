import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Image, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  Screen,
  VStack,
  HStack,
  Text,
  Pressable,
  Escudo,
  Avatar,
} from '../../../../components/primitives';
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

const ACCENT = '#bb5d3a';
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
          {cover ? (
            <Image source={{ uri: cover }} className="w-full h-40" resizeMode="cover" />
          ) : null}
          <VStack gap={1} className={`items-center px-4 ${cover ? '-mt-12' : 'pt-4'}`}>
            <View className="bg-surface rounded-2xl p-2 shadow-sm">
              <Escudo url={village?.escudoUrl} size={96} fallbackInitial={village?.name} />
            </View>
            <Text variant="h2" className="mt-2 text-center">
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
          </VStack>

          {/* ── Stats ────────────────────────────────────────────── */}
          <HStack className="items-center justify-center py-5">
            <Stat value={barrios.length} label={t('village.admin.hub.barrios')} />
            <Separator />
            <Stat value={places.length} label={t('village.admin.hub.places')} />
            <Separator />
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

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <VStack className="items-center px-5">
      <Text variant="h2">{value}</Text>
      <Text tone="muted" variant="bodySm">
        {label}
      </Text>
    </VStack>
  );
}

function Separator() {
  return <View className="w-px h-8 bg-subtle" />;
}

function Section({
  title,
  onManage,
  isEmpty,
  emptyLabel,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  onManage: () => void;
  isEmpty: boolean;
  emptyLabel: string;
  addLabel?: string;
  onAdd?: () => void;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <VStack gap={3} className="pt-4">
      <HStack className="items-center justify-between px-4">
        <Text variant="h3">{title}</Text>
        <Pressable onPress={onManage} accessibilityLabel={t('village.admin.overview.manage')}>
          <Text variant="bodySm" style={{ color: ACCENT }} className="font-medium">
            {t('village.admin.overview.manage')}
          </Text>
        </Pressable>
      </HStack>
      {isEmpty && !onAdd ? (
        <Text tone="muted" variant="bodySm" className="px-4">
          {emptyLabel}
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-4 gap-3"
        >
          {children}
          {onAdd && addLabel ? <AddCard label={addLabel} onPress={onAdd} /> : null}
        </ScrollView>
      )}
    </VStack>
  );
}

function PersonCard({
  name,
  photoURL,
  badge,
  onPress,
}: {
  name: string;
  photoURL: string | null;
  badge?: string;
  onPress?: () => void;
}) {
  const initials = name.slice(0, 1).toUpperCase();
  const body = (
    <View
      className="w-24 items-center rounded-2xl py-3 px-2 gap-2 bg-surface-elevated"
      style={badge ? { borderWidth: 1, borderColor: ACCENT } : undefined}
    >
      <Avatar uri={photoURL} size={56} initials={initials} />
      <Text variant="bodySm" className="font-medium text-center" numberOfLines={1}>
        {name}
      </Text>
      {badge ? (
        <Text variant="bodySm" style={{ color: ACCENT }} className="text-center" numberOfLines={1}>
          {badge}
        </Text>
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityLabel={name}>
      {body}
    </Pressable>
  );
}

function EntityCard({
  label,
  sub,
  icon,
  onPress,
}: {
  label: string;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className="w-36 bg-surface-elevated rounded-2xl p-4"
    >
      <Ionicons name={icon} size={28} color={ACCENT} />
      <Text variant="bodySm" className="mt-3 font-medium" numberOfLines={2}>
        {label}
      </Text>
      {sub ? (
        <Text tone="muted" variant="bodySm" numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

function AddCard({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className="w-36 border border-dashed border-subtle rounded-2xl p-4 items-center justify-center"
    >
      <Ionicons name="add" size={28} color={ACCENT} />
      <Text variant="bodySm" className="mt-3 font-medium text-center" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function SettingsLink({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center bg-surface border border-subtle rounded-xl p-3"
    >
      <Ionicons name={icon} size={20} color="#0f172a" />
      <Text className="ml-3 flex-1">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
    </Pressable>
  );
}
