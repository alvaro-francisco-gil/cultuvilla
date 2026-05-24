import { useEffect, useState } from 'react';
import { useLocalSearchParams, Link } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../../components/layout/AppHeader';
import { router } from 'expo-router';
import { Screen } from '../../../components/primitives/Screen';
import { VStack } from '../../../components/primitives/VStack';
import { Text } from '../../../components/primitives/Text';
import { EventCard } from '../../../components/feature/EventCard';
import { useT } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth/useAuth';
import { useIsAppAdmin } from '../../../lib/auth/useIsAppAdmin';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { getEventsByMunicipality } from '@cultuvilla/shared/services/eventService';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
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

  useEffect(() => {
    if (!user || !villageId) return;
    isVillageAdmin(villageId as string, user.uid).then(setVillageAdmin);
  }, [user, villageId]);
  const canManage = isAppAdmin || villageAdmin;

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
      <Screen padded={false}>
        <AppHeader centerLabel={village?.name} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen padded={false}>
        <AppHeader centerLabel={village?.name} />
        <View className="p-4">
          <Text tone="danger">{error}</Text>
        </View>
      </Screen>
    );
  }

  if (!village) {
    return (
      <Screen padded={false}>
        <AppHeader />
        <View className="p-4">
          <Text tone="muted">{villageId}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <AppHeader centerLabel={village.name} extraRightSlot={adminSlot} />
      <VStack gap={4} className="p-4">
        <Text variant="h1">{village.name}</Text>
        <Link href={`/village/${village.id}/censo`}>
          <Text tone="muted">{t('village.censo.link')}</Text>
        </Link>
      </VStack>
      <FlatList
        contentContainerClassName="p-4 gap-4"
        data={events}
        keyExtractor={(e) => e.id}
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
