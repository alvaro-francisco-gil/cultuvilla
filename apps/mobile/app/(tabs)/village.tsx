import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Screen, Text, VStack, Escudo } from '../../components/primitives';
import { AppHeader } from '../../components/layout/AppHeader';
import { VillageDiscovery } from '../../components/feature/VillageDiscovery';
import { useAuth } from '../../lib/auth/useAuth';
import { useIsAppAdmin } from '../../lib/auth/useIsAppAdmin';
import { useT } from '../../lib/i18n';
import {
  getUserMemberships,
  isVillageAdmin,
} from '@cultuvilla/shared/services/villageMemberService';
import { setActiveMunicipality } from '@cultuvilla/shared/services/userService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';

type Village = MunicipalityData & { id: string };

type HubAction = {
  key: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  href: string;
};

export default function VillageTabScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useT();
  const { isAppAdmin } = useIsAppAdmin();
  const [resolving, setResolving] = useState(true);
  const [village, setVillage] = useState<Village | null>(null);
  const [villageAdmin, setVillageAdmin] = useState(false);

  const activeMunicipalityId = profile?.activeMunicipalityId ?? null;

  // Resolve an active municipality: if profile has none, pick the first
  // membership (if any) and persist it so future loads skip this step.
  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!user || !profile) {
        if (!cancelled) setResolving(false);
        return;
      }
      if (profile.activeMunicipalityId) {
        if (!cancelled) setResolving(false);
        return;
      }
      const memberships = await getUserMemberships(user.uid);
      if (cancelled) return;
      const first = memberships[0];
      if (first) {
        await setActiveMunicipality(user.uid, first.municipalityId);
        await refreshProfile();
      }
      if (!cancelled) setResolving(false);
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [user, profile, refreshProfile]);

  const loadVillage = useCallback(async () => {
    if (!activeMunicipalityId) {
      setVillage(null);
      setVillageAdmin(false);
      return;
    }
    const [mun, isAdmin] = await Promise.all([
      getMunicipality(activeMunicipalityId),
      user ? isVillageAdmin(activeMunicipalityId, user.uid) : Promise.resolve(false),
    ]);
    setVillage(mun);
    setVillageAdmin(isAdmin);
  }, [activeMunicipalityId, user]);

  useEffect(() => {
    void loadVillage();
  }, [loadVillage]);

  useFocusEffect(
    useCallback(() => {
      void loadVillage();
    }, [loadVillage])
  );

  if (resolving) {
    return (
      <Screen padded={false} topInset={false}>
        <AppHeader />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (!activeMunicipalityId) {
    return (
      <Screen padded={false} topInset={false}>
        <AppHeader />
        <VillageDiscovery />
      </Screen>
    );
  }

  if (!village) {
    return (
      <Screen padded={false} topInset={false}>
        <AppHeader />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  const canManage = isAppAdmin || villageAdmin;
  const adminSlot = canManage ? (
    <Pressable
      onPress={() => router.push(`/village/${village.id}/admin` as never)}
      accessibilityLabel={t('village.admin.open')}
      className="p-1"
    >
      <Ionicons name="settings-outline" size={22} color="#0f172a" />
    </Pressable>
  ) : null;

  const actions: HubAction[] = [
    {
      key: 'events',
      label: t('village.hub.events'),
      icon: 'calendar',
      href: `/village/${village.id}`,
    },
    {
      key: 'organizations',
      label: t('village.hub.organizations'),
      icon: 'people',
      href: `/village/${village.id}/organizations`,
    },
    {
      key: 'censo',
      label: t('village.hub.censo'),
      icon: 'document-text',
      href: `/village/${village.id}/censo`,
    },
    {
      key: 'news',
      label: t('village.hub.news'),
      icon: 'newspaper',
      href: `/village/${village.id}`,
    },
  ];

  return (
    <Screen padded={false} topInset={false}>
      <AppHeader centerLabel={village.name} extraRightSlot={adminSlot} />
      <FlatList
        contentContainerClassName="p-4"
        data={actions}
        numColumns={2}
        keyExtractor={(a) => a.key}
        columnWrapperStyle={{ gap: 12 }}
        ListHeaderComponent={
          <VStack gap={2} className="items-center pt-2 pb-6">
            <Escudo url={village.escudoUrl} size={96} fallbackInitial={village.name} />
            <Text variant="h2" className="mt-2">
              {village.name}
            </Text>
            <Text tone="muted" variant="bodySm">
              {village.province}
            </Text>
          </VStack>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(item.href as never)}
            accessibilityLabel={item.label}
            className="flex-1 bg-surface-elevated rounded-2xl py-8 items-center mb-3"
          >
            <Ionicons name={item.icon} size={32} color="#bb5d3a" />
            <Text variant="bodySm" className="mt-3 font-medium">
              {item.label}
            </Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}
