import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { AppHeader } from '../../../components/layout/AppHeader';
import { router } from 'expo-router';
import { Screen } from '../../../components/primitives/Screen';
import { VStack } from '../../../components/primitives/VStack';
import { Text } from '../../../components/primitives/Text';
import { Escudo } from '../../../components/primitives/Escudo';
import { EventCard } from '../../../components/feature/EventCard';
import { useT } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth/useAuth';
import { useIsAppAdmin } from '../../../lib/auth/useIsAppAdmin';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { getEventsByMunicipality } from '@cultuvilla/shared/services/eventService';
import {
  isVillageAdmin,
  isVillageMember,
  addVillageMember,
} from '@cultuvilla/shared/services/villageMemberService';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { EventData } from '@cultuvilla/shared/models/event/EventDataModel';

type Village = MunicipalityData & { id: string };
type Event = EventData & { id: string };

export default function VillageHome() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const { user } = useAuth();
  const { isAppAdmin } = useIsAppAdmin();
  const [village, setVillage] = useState<Village | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [villageAdmin, setVillageAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!user || !villageId) return;
    isVillageAdmin(villageId as string, user.uid).then(setVillageAdmin);
    isVillageMember(villageId as string, user.uid).then(setIsMember);
  }, [user, villageId]);
  const canManage = isAppAdmin || villageAdmin;

  const onJoin = async () => {
    if (!user || !villageId) {
      router.push('/(auth)/login' as never);
      return;
    }
    setJoining(true);
    try {
      await addVillageMember(villageId as string, user.uid);
      setIsMember(true);
    } finally {
      setJoining(false);
    }
  };

  const adminSlot = canManage ? (
    <Pressable
      onPress={() => router.push(`/village/${villageId}/admin` as never)}
      accessibilityLabel={t('village.admin.open')}
      className="p-1"
    >
      <Ionicons name="settings-outline" size={22} color="#0f172a" />
    </Pressable>
  ) : null;

  useEffect(() => {
    if (!villageId) return;
    async function load() {
      try {
        setError(null);
        const [mun, evts] = await Promise.all([
          getMunicipality(villageId as string),
          getEventsByMunicipality(villageId as string, 'published'),
        ]);
        setVillage(mun);
        setEvents(evts);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'unknown');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [villageId]);

  if (loading) {
    return (
      <Screen padded={false} topInset={false}>
        <AppHeader centerLabel={village?.name} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen padded={false} topInset={false}>
        <AppHeader centerLabel={village?.name} />
        <View className="p-4">
          <Text tone="danger">{error}</Text>
        </View>
      </Screen>
    );
  }

  if (!village) {
    return (
      <Screen padded={false} topInset={false}>
        <AppHeader />
        <View className="p-4">
          <Text tone="muted">{villageId}</Text>
        </View>
      </Screen>
    );
  }

  const hubActions: Array<{
    key: string;
    label: string;
    icon: ComponentProps<typeof Ionicons>['name'];
    onPress: () => void;
  }> = [
    {
      key: 'organizations',
      label: t('village.hub.organizations'),
      icon: 'people',
      onPress: () => router.push(`/village/${village.id}/organizations` as never),
    },
    {
      key: 'censo',
      label: t('village.hub.censo'),
      icon: 'document-text',
      onPress: () => router.push(`/village/${village.id}/censo` as never),
    },
  ];

  return (
    <Screen padded={false} topInset={false}>
      <AppHeader centerLabel={village.name} extraRightSlot={adminSlot} />
      <FlatList
        contentContainerClassName="p-4 gap-4"
        data={events}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={
          <VStack gap={4} className="pb-2">
            <View className="items-center pt-2 pb-1">
              <Escudo url={village.escudoUrl} size={96} fallbackInitial={village.name} />
              <Text variant="h2" className="mt-2">{village.name}</Text>
              <Text tone="muted" variant="bodySm">{village.province}</Text>
            </View>
            {!isMember ? (
              <Pressable
                onPress={onJoin}
                disabled={joining}
                accessibilityLabel={t('village.join')}
                className="bg-primary rounded-lg p-3 items-center"
              >
                <Text tone="onAccent">
                  {user ? t('village.join') : t('village.signInToJoin')}
                </Text>
              </Pressable>
            ) : null}
            <View className="flex-row flex-wrap -mx-1">
              {hubActions.map((a) => (
                <View key={a.key} className="w-1/2 px-1 pb-2">
                  <Pressable
                    onPress={a.onPress}
                    accessibilityLabel={a.label}
                    className="bg-surface-elevated rounded-lg p-4 items-center"
                  >
                    <Ionicons name={a.icon} size={28} color="#bb5d3a" />
                    <Text variant="bodySm" className="mt-2">
                      {a.label}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
            <Text variant="h3">{t('village.events.label')}</Text>
          </VStack>
        }
        ListEmptyComponent={<Text tone="muted">{t('village.events.empty')}</Text>}
        renderItem={({ item }) => (
          <EventCard
            event={{
              id: item.id,
              title: item.title,
              startDate: item.startDate,
              organizationName: item.organizationName,
            }}
            onPress={(id) => router.push(`/event/${id}`)}
          />
        )}
      />
    </Screen>
  );
}
