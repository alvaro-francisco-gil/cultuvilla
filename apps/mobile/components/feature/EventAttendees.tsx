import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { Text } from '../primitives/Text';
import { Pressable } from '../primitives/Pressable';
import { DetailSectionHeading } from './DetailSectionHeading';
import {
  getEventRegistrations,
  getRegistrationPhone,
  cancelRegistration,
} from '@cultuvilla/shared/services/registrationService';
import type { RegistrationData } from '@cultuvilla/shared/models/event/RegistrationDataModel';
import { colors, iconSizes } from '@cultuvilla/shared/design-system';
import { useT } from '../../lib/i18n';

type Row = RegistrationData & { id: string };

/**
 * Organizer-only attendee roster shown inline on the event detail screen: who
 * is going, their phone (only when the event required one), and a per-row
 * remove. Reads through registrationService; the phone column relies on the
 * organizer-scoped `getRegistrationPhone` read.
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

  const load = useCallback(async () => {
    const regs = await getEventRegistrations(eventId);
    setRows(regs);
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
            <View className="flex-1">
              <Text>{r.name}</Text>
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
