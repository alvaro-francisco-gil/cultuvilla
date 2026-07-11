import { useCallback, useEffect, useState } from 'react';
import { Linking, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { Text } from '../primitives/Text';
import { Pressable } from '../primitives/Pressable';
import { Button } from '../primitives/Button';
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
import { showConfirm } from '../../lib/dialogs';

type Row = RegistrationData & { id: string };

/**
 * Organizer-only attendee roster shown inline on the event detail screen: a
 * circular profile photo (from the attendee's person, initials fallback) and
 * the name, with per-row call (only when the event required a phone) and
 * remove actions. Tapping call opens a dialog with the number to dial.
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
  const [callTarget, setCallTarget] = useState<{ name: string; phone: string } | null>(null);

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
          <HStack key={r.id} gap={3} align="center" className="py-2">
            <Avatar uri={photos[r.id]} size={36} initials={r.name.slice(0, 1).toUpperCase()} />
            <Text numberOfLines={1} className="flex-1">
              {r.name}
            </Text>
            {telephoneRequired && phones[r.id] ? (
              <Pressable
                testID={`call-attendee-${r.id}`}
                accessibilityLabel={t('event.call')}
                onPress={() => setCallTarget({ name: r.name, phone: phones[r.id] ?? '' })}
              >
                <Ionicons name="call-outline" size={iconSizes.md} color={colors.light.fg.accent} />
              </Pressable>
            ) : null}
            <Pressable
              testID={`remove-attendee-${r.id}`}
              accessibilityLabel={t('common.delete')}
              onPress={() =>
                showConfirm(
                  t('event.removeAttendeeTitle'),
                  t('event.removeAttendeeBody', { name: r.name }),
                  () => void cancelRegistration(eventId, r.id).then(load),
                  { confirmText: t('event.removeAttendeeConfirm'), cancelText: t('common.cancel') },
                )
              }
            >
              <Ionicons name="trash-outline" size={iconSizes.md} color={colors.light.fg.danger} />
            </Pressable>
          </HStack>
        ))
      )}

      <Modal
        visible={callTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCallTarget(null)}
      >
        <Pressable
          onPress={() => setCallTarget(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          className="items-center justify-center px-8"
        >
          {/* Inner press-catcher: taps inside the card must not dismiss. */}
          <Pressable onPress={() => {}} className="w-full rounded-lg bg-surface-elevated p-5 border border-subtle">
            {callTarget ? (
              <VStack gap={3}>
                <Text variant="h3">{callTarget.name}</Text>
                <Text variant="h2" style={{ color: colors.light.fg.accent }}>
                  {callTarget.phone}
                </Text>
                <HStack gap={3} className="justify-end items-center">
                  <Button variant="ghost" onPress={() => setCallTarget(null)}>
                    {t('common.close')}
                  </Button>
                  <Button
                    variant="primary"
                    onPress={() => {
                      const phone = callTarget.phone;
                      setCallTarget(null);
                      void Linking.openURL(`tel:${phone}`).catch(() => {});
                    }}
                  >
                    {t('event.call')}
                  </Button>
                </HStack>
              </VStack>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </VStack>
  );
}
