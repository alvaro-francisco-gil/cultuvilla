import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { ErrorState } from '../../components/primitives/ErrorState';
import { EventCard } from '../../components/feature/EventCard';
import { SegmentedToggle } from '../../components/feature/SegmentedToggle';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { splitEventsByTime } from '../../lib/registrations/splitEventsByTime';
import { getUserRegistrationsAcrossEvents } from '@cultuvilla/shared/services/registrationService';
import { getEvent } from '@cultuvilla/shared/services/eventService';
import type { EventData } from '@cultuvilla/shared/models/event/EventDataModel';

type Row = EventData & { id: string };
type RegistrationsTab = 'proximos' | 'pasados';

const TABS = ['proximos', 'pasados'] as const satisfies readonly RegistrationsTab[];

const TAB_LABEL_KEY: Record<RegistrationsTab, string> = {
  proximos: 'me.registrations.tab.upcoming',
  pasados: 'me.registrations.tab.past',
};

const TAB_EMPTY_KEY: Record<RegistrationsTab, string> = {
  proximos: 'me.registrations.emptyUpcoming',
  pasados: 'me.registrations.emptyPast',
};

export default function MyRegistrationsScreen() {
  const { user } = useAuth();
  const { t } = useT();
  const [events, setEvents] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RegistrationsTab>('proximos');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      setEvents(null);
      const regs = await getUserRegistrationsAcrossEvents(user.uid);
      const eventIds = Array.from(
        new Set(
          regs
            .map((r) => r.eventPath.split('/')[1])
            .filter((id): id is string => typeof id === 'string'),
        ),
      );
      const fetched = await Promise.all(eventIds.map((id) => getEvent(id)));
      setEvents(fetched.filter((e): e is Row => e !== null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // `new Date()` is read once per fetched batch, not per render: the split only
  // ever moves an event across the boundary at midnight, and a reload re-reads it.
  const { upcoming, past } = useMemo(
    () => splitEventsByTime(events ?? [], new Date()),
    [events],
  );
  const visible = activeTab === 'proximos' ? upcoming : past;

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('me.registrations.title')} />
      <View className="px-4 pt-3 pb-2">
        <SegmentedToggle<RegistrationsTab>
          value={activeTab}
          onChange={setActiveTab}
          options={TABS.map((tab) => ({ value: tab, label: t(TAB_LABEL_KEY[tab]) }))}
        />
      </View>
      {events === null && !error ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <ErrorState error={error} onRetry={load} />
      ) : (
        <FlatList
          contentContainerClassName="p-4 gap-4"
          data={visible}
          keyExtractor={(e) => e.id}
          ListEmptyComponent={<Text tone="muted">{t(TAB_EMPTY_KEY[activeTab])}</Text>}
          renderItem={({ item }) => (
            <EventCard
              event={{
                id: item.id,
                title: item.title,
                startDate: item.startDate,
                locationName: item.location?.displayName ?? null,
                imageURL: item.imageURL,
                villageCoverImage: item.villageCoverImage,
                commentCount: item.commentCount,
              }}
              onPress={(id) => router.push(`/event/${id}`)}
            />
          )}
        />
      )}
    </Screen>
  );
}
