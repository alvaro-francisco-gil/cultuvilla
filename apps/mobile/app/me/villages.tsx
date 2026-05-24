import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { Pressable } from '../../components/primitives/Pressable';
import { Button } from '../../components/primitives/Button';
import { VStack } from '../../components/primitives/VStack';
import { Escudo } from '../../components/primitives/Escudo';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import {
  getUserMemberships,
  type UserMembership,
} from '@cultuvilla/shared/services/villageMemberService';
import { setActiveMunicipality } from '@cultuvilla/shared/services/userService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';

type Row = UserMembership & { name: string; escudoThumbUrl: string | null };

export default function MyVillagesScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      try {
        setError(null);
        const memberships = await getUserMemberships(user!.uid);
        const named = await Promise.all(
          memberships.map(async (m) => {
            const muni = await getMunicipality(m.municipalityId);
            return {
              ...m,
              name: muni?.name ?? m.municipalityId,
              escudoThumbUrl: muni?.escudoThumbUrl ?? null,
            };
          }),
        );
        if (!cancelled) setRows(named);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'unknown');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function selectVillage(municipalityId: string) {
    if (!user) return;
    setSwitchingId(municipalityId);
    try {
      await setActiveMunicipality(user.uid, municipalityId);
      await refreshProfile();
      router.replace('/(tabs)/village');
    } finally {
      setSwitchingId(null);
    }
  }

  const activeId = profile?.activeMunicipalityId ?? null;

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('villageSwitcher.title')} />
      {rows === null && !error ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="p-4">
          <Text tone="danger">{error}</Text>
        </View>
      ) : (
        <FlatList
          data={rows ?? []}
          keyExtractor={(r) => r.municipalityId}
          contentContainerClassName="p-4 gap-3"
          ListEmptyComponent={<Text tone="muted">{t('me.villages.empty')}</Text>}
          ListFooterComponent={
            <View className="pt-4">
              <Button variant="ghost" onPress={() => router.push('/(tabs)/village')}>
                <Text>{t('villageSwitcher.findAnother')}</Text>
              </Button>
            </View>
          }
          renderItem={({ item }) => {
            const isActive = item.municipalityId === activeId;
            const isAdmin = item.role === 'admin';
            const isBusy = switchingId === item.municipalityId;
            return (
              <Pressable
                onPress={() => selectVillage(item.municipalityId)}
                disabled={isActive || isBusy}
                className={
                  'flex-row items-center p-3 rounded-md border ' +
                  (isActive ? 'border-strong bg-surface-elevated' : 'border-subtle bg-surface')
                }
              >
                <Escudo url={item.escudoThumbUrl} size={36} fallbackInitial={item.name} />
                <View className="flex-1 ml-3">
                  <VStack gap={1}>
                    <Text className="font-semibold">{item.name}</Text>
                    <Text tone="muted" variant="caption">
                      {isAdmin ? t('me.villages.adminBadge') : t('me.villages.memberBadge')}
                    </Text>
                  </VStack>
                </View>
                {isBusy ? (
                  <ActivityIndicator />
                ) : isActive ? (
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                    <Text variant="caption" tone="success" className="ml-1 font-semibold uppercase">
                      {t('me.villages.activeBadge')}
                    </Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}
