import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Screen, Text, VStack, Escudo, Button } from '../../components/primitives';
import { AppHeader } from '../../components/layout/AppHeader';
import { VillageDiscovery } from '../../components/feature/VillageDiscovery';
import { useAuth } from '../../lib/auth/useAuth';
import { useIsAppAdmin } from '../../lib/auth/useIsAppAdmin';
import { useT } from '../../lib/i18n';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
import { withFirestoreErrorLog } from '../../lib/firestoreErrorLog';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { getMyOrganizerRequests } from '@cultuvilla/shared/services/organizerRequestService';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';

type Village = MunicipalityData & { id: string };

type HubAction = {
  key: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  href: string;
};

export default function VillageTabScreen() {
  const { user, profile, profileChecked } = useAuth();
  const { t } = useT();
  const { isAppAdmin } = useIsAppAdmin();
  const [village, setVillage] = useState<Village | null>(null);
  const [villageAdmin, setVillageAdmin] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingOrganizerRequest, setPendingOrganizerRequest] = useState(false);

  const activeMunicipalityId = profile?.activeMunicipalityId ?? null;

  const loadVillage = useCallback(async () => {
    if (!activeMunicipalityId) {
      setVillage(null);
      setVillageAdmin(false);
      setPendingOrganizerRequest(false);
      setLoadError(null);
      return;
    }
    try {
      const [mun, isAdmin, myReqs] = await Promise.all([
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
      ]);
      setVillage(mun);
      setVillageAdmin(isAdmin);
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
  }, [activeMunicipalityId, user]);

  useEffect(() => {
    void loadVillage();
  }, [loadVillage]);

  useFocusEffect(
    useCallback(() => {
      void loadVillage();
    }, [loadVillage])
  );

  // AuthGate already waits for `profileChecked`, but guard once more for safety.
  if (!profileChecked) {
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

  if (loadError) {
    return (
      <Screen padded={false} topInset={false}>
        <AppHeader />
        <View className="flex-1 items-center justify-center px-8">
          <Text tone="danger">{loadError}</Text>
        </View>
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

  if (!village.communityActive) {
    return (
      <Screen padded={false} topInset={false}>
        <AppHeader centerLabel={village.name} />
        <View className="flex-1 items-center justify-center px-8">
          <VStack gap={2} className="items-center">
            <Escudo url={village.escudoUrl} size={96} fallbackInitial={village.name} />
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
