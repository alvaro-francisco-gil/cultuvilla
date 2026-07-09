import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { Text } from '../primitives/Text';
import { Pressable } from '../primitives/Pressable';
import { Avatar } from '../primitives/Avatar';
import { DetailSectionHeading } from './DetailSectionHeading';
import {
  getEventRegistrations,
  getRegistrationPhone,
  cancelRegistration,
} from '@cultuvilla/shared/services/registrationService';
import { getPerson } from '@cultuvilla/shared/services/personService';
import type { RegistrationData } from '@cultuvilla/shared/models/event/RegistrationDataModel';
import { colors, iconSizes } from '@cultuvilla/shared/design-system';
import { useT } from '../../lib/i18n';

type Row = RegistrationData & { id: string };

/**
 * Organizer-only attendee roster shown inline on the event detail screen: a
 * circular profile photo (from the attendee's person, initials fallback), the
 * name, their phone (only when the event required one), and a per-row remove.
 * Matches the LiveOwnerChip look used for organizers.
 */
export function EventAttendees({
  eventId,
  telephoneRequired,
}: {
  eventId: string;
  telephoneRequired: boolean;
}) {
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [phones, setPhones] = useState<Record<string, string | null>>({});
  const [photos, setPhotos] = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    const regs = await getEventRegistrations(eventId);
    setRows(regs);
    // Photo isn't denormalised on the registration, so resolve it per person.
    // A missing/private person just falls back to the initials avatar.
    const photoEntries = await Promise.all(
      regs.map(async (r) => {
        const person = r.personId ? await getPerson(r.personId).catch(() => null) : null;
        return [r.id, person?.photoURL ?? null] as const;
      }),
    );
    setPhotos(Object.fromEntries(photoEntries));
    if (telephoneRequired) {
      const entries = await Promise.all(
        regs.map(async (r) => [r.id, await getRegistrationPhone(eventId, r.id)] as const),
      );
      setPhones(Object.fromEntries(entries));
    }
  }, [eventId, telephoneRequired]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <VStack gap={2}>
      <DetailSectionHeading>{t('event.attendees')}</DetailSectionHeading>
      {rows && rows.length === 0 ? (
        <Text tone="muted" variant="bodySm">
          {t('event.attendeesEmpty')}
        </Text>
      ) : (
        (rows ?? []).map((r) => (
          <HStack key={r.id} gap={2} align="center" className="py-2">
            <Avatar uri={photos[r.id]} size={36} initials={r.name.slice(0, 1).toUpperCase()} />
            <View className="flex-1">
              <Text numberOfLines={1}>{r.name}</Text>
              {telephoneRequired && phones[r.id] ? (
                <Text tone="muted" variant="bodySm">
                  {phones[r.id]}
                </Text>
              ) : null}
            </View>
            <Pressable
              testID={`remove-attendee-${r.id}`}
              accessibilityLabel={t('common.delete')}
              onPress={() => void cancelRegistration(eventId, r.id).then(load)}
            >
              <Ionicons name="trash-outline" size={iconSizes.md} color={colors.light.fg.danger} />
            </Pressable>
          </HStack>
        ))
      )}
    </VStack>
  );
}
