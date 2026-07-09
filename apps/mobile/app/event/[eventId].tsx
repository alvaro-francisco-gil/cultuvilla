import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Linking, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/primitives/Screen';
import { VStack } from '../../components/primitives/VStack';
import { HStack } from '../../components/primitives/HStack';
import { Text } from '../../components/primitives/Text';
import { Button } from '../../components/primitives/Button';
import { Card } from '../../components/primitives/Card';
import { Pressable } from '../../components/primitives/Pressable';
import { LiveOwnerChip } from '../../components/feature/LiveOwnerChip';
import { RegisterFab } from '../../components/feature/RegisterFab';
import { useEventOrganizer } from '../../lib/events/useEventOrganizer';
import { DetailHeroImage } from '../../components/feature/DetailHeroImage';
import { FloatingBackButton } from '../../components/feature/FloatingBackButton';
import { FloatingShareButton } from '../../components/feature/FloatingShareButton';
import { FloatingEditButton } from '../../components/feature/FloatingEditButton';
import { FloatingManageButton } from '../../components/feature/FloatingManageButton';
import { useAuth } from '../../lib/auth/useAuth';
import { useRegisterGate } from '../../lib/auth/RegisterGateContext';
import { useShareDeepLink } from '../../lib/deeplink/useShareDeepLink';
import { getEvent } from '@cultuvilla/shared/services/eventService';
import { getEventLink } from '@cultuvilla/shared/services/deepLinkService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { buildDisplayName } from '@cultuvilla/shared/models/person/PersonDataModel';
import { formatDate, buildGoogleCalendarUrl } from '@cultuvilla/shared/utils';
import { colors, iconSizes } from '@cultuvilla/shared/design-system';
import { useT } from '../../lib/i18n';
import type { EventData } from '@cultuvilla/shared/models/event/EventDataModel';
import type { PersonData } from '@cultuvilla/shared/models/person/PersonDataModel';

type EventDoc = EventData & { id: string };
type PersonDoc = PersonData & { id: string };

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();
  const gate = useRegisterGate();
  const { t } = useT();
  const share = useShareDeepLink();
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [person, setPerson] = useState<PersonDoc | null>(null);
  const { canOrganize } = useEventOrganizer(event);

  useEffect(() => {
    if (!eventId) return;
    void (async () => {
      const e = await getEvent(eventId);
      setEvent(e);
    })();
  }, [eventId]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const p = await getPersonByUserId(user.uid);
      setPerson(p);
    })();
  }, [user]);

  if (!event) {
    return (
      <Screen padded={false} topInset={false}>
        <StatusBar style="light" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
        <FloatingBackButton />
      </Screen>
    );
  }

  const personName = person ? buildDisplayName(person) : '';

  const openInMaps = () => {
    const c = event.location?.coordinates;
    if (!c) return;
    void Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`,
    ).catch(() => {
      /* best-effort */
    });
  };

  const addToCalendar = () => {
    void Linking.openURL(
      buildGoogleCalendarUrl({
        title: event.title,
        start: event.startDate,
        end: event.endDate,
        details: event.description,
        location: event.location?.displayName,
      }),
    ).catch(() => {
      /* best-effort */
    });
  };

  return (
    <Screen padded={false} topInset={false}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
      <DetailHeroImage
        imageUri={event.imageURL}
        fallbackImageUri={event.villageCoverImage}
        fallbackIcon="calendar-outline"
      />
      <FloatingBackButton />
      <FloatingShareButton onPress={() => void share(getEventLink(event.id), event.title)} />
      {canOrganize && (
        <>
          <FloatingManageButton
            accessibilityLabel={t('event.manageEvent')}
            onPress={() => router.push(`/event/${event.id}/organize` as never)}
          />
          <FloatingEditButton
            accessibilityLabel={t('event.editEvent')}
            onPress={() => router.push(`/event/new?eventId=${event.id}` as never)}
          />
        </>
      )}
      <VStack gap={4} className="p-4">
        <Text variant="h1">{event.title}</Text>
        <HStack gap={3} align="stretch">
          <InfoCard
            icon="calendar-outline"
            label={t('event.dateTime')}
            value={formatDate(event.startDate, 'dayMonth')}
            detail={formatDate(event.startDate, 'time')}
            action={t('event.addToCalendar')}
            onPress={addToCalendar}
          />
          {event.location ? (
            <InfoCard
              icon="location-outline"
              label={t('event.location')}
              value={event.location.displayName}
              action={t('event.locationPin')}
              onPress={openInMaps}
            />
          ) : null}
        </HStack>
        {(event.organizerUserIds?.length > 0 || event.organizerOrgIds?.length > 0) && (
          <VStack gap={2}>
            <Text tone="muted">{t('event.organizersLabel')}</Text>
            {event.organizerOrgIds?.map((id) => (
              <LiveOwnerChip key={id} ownerType="organization" ownerId={id} />
            ))}
            {event.organizerUserIds?.map((id) => (
              <LiveOwnerChip key={id} ownerType="user" ownerId={id} />
            ))}
          </VStack>
        )}
        {event.description ? <Text>{event.description}</Text> : null}

        {!user && (
          <Button
            variant="primary"
            fullWidth
            onPress={() => gate.requireAuth(`/event/${event.id}`, t('guest.event'))}
          >
            {t('guest.eventCta')}
          </Button>
        )}
        {!person && user && (
          <Text tone="muted">{t('event.register.needsPerson')}</Text>
        )}
      </VStack>
      </ScrollView>
      {person && user && (
        <RegisterFab
          eventId={event.id}
          userId={user.uid}
          personId={person.id}
          name={personName}
          telephoneRequired={!!event.telephoneRequired}
        />
      )}
    </Screen>
  );
}

/** A tappable "rectangle" summarising one fact (when / where) with a link out. */
function InfoCard({
  icon,
  label,
  value,
  detail,
  action,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  detail?: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="flex-1">
      <Card className="h-full">
        <VStack gap={1}>
          <HStack gap={2} align="center">
            <Ionicons name={icon} size={iconSizes.md} color={colors.light.fg.accent} />
            <Text variant="caption" tone="muted">{label}</Text>
          </HStack>
          <Text variant="h3" numberOfLines={2}>{value}</Text>
          {detail ? <Text tone="muted">{detail}</Text> : null}
          <Text variant="caption" className="text-accent">{`${action} →`}</Text>
        </VStack>
      </Card>
    </Pressable>
  );
}
