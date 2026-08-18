import { useCallback, useEffect, useState } from 'react';
import { Linking, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { Text } from '../primitives/Text';
import { Pressable } from '../primitives/Pressable';
import { Button } from '../primitives/Button';
import { Avatar } from '../primitives/Avatar';
import { DetailSectionHeading } from './DetailSectionHeading';
import { SectionEditToggle } from './SectionEditToggle';
import {
  getEventRegistrations,
  getRegistrationPhone,
  cancelRegistration,
  setRegistrationPaid,
} from '@cultuvilla/shared/services/registrationService';
import { getPerson } from '@cultuvilla/shared/services/personService';
import type { RegistrationData } from '@cultuvilla/shared/models/event/RegistrationDataModel';
import { colors, iconSizes } from '@cultuvilla/shared/design-system';
import { formatDate } from '@cultuvilla/shared/utils/format';
import { useT } from '../../lib/i18n';
import { showConfirm } from '../../lib/dialogs';

type Row = RegistrationData & { id: string };

type AttendeePerson = { photoURL: string | null; userId: string | null };

/**
 * Organizer-only attendee roster shown inline on the event detail screen: a
 * circular profile photo (from the attendee's person, initials fallback), the
 * name (which opens that attendee's profile) and the moment they signed up —
 * the roster is ordered by that same moment, so the timestamp doubles as the
 * queue position an organizer can point at. Marking paid and calling (only
 * when the event required a phone) are always available — they're the running
 * ops of an event; tapping call opens a dialog with the number to dial.
 * Removing an attendee is destructive, so the trash icons stay hidden until the
 * heading's "Editar" toggle is on — and the toggle itself only appears once
 * there is at least one attendee to edit.
 */
export function EventAttendees({
  eventId,
  telephoneRequired,
  requiresPayment,
}: {
  eventId: string;
  telephoneRequired: boolean;
  requiresPayment: boolean;
}) {
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [phones, setPhones] = useState<Record<string, string | null>>({});
  const [people, setPeople] = useState<Record<string, AttendeePerson>>({});
  const [callTarget, setCallTarget] = useState<{ name: string; phone: string } | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const regs = await getEventRegistrations(eventId);
    setRows(regs);
    // Neither the photo nor the account link is denormalised on the
    // registration, so resolve the person per row. A missing/private person
    // just falls back to the initials avatar and a non-tappable row.
    const personEntries = await Promise.all(
      regs.map(async (r) => {
        const person = r.personId ? await getPerson(r.personId).catch(() => null) : null;
        return [
          r.id,
          { photoURL: person?.photoURL ?? null, userId: person?.userId ?? null },
        ] as const;
      }),
    );
    setPeople(Object.fromEntries(personEntries));
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

  const togglePaid = useCallback(
    async (regId: string, next: boolean) => {
      await setRegistrationPaid(eventId, regId, next);
      await load();
    },
    [eventId, load],
  );

  // getEventRegistrations already orders by `registeredAt`, so the split keeps
  // each section in sign-up order. Waitlist promotion is automatic (a Cloud
  // Function fires when a confirmed reg is removed) — no manual promote action.
  const confirmed = (rows ?? []).filter((r) => r.status === 'confirmed');
  const waitlisted = (rows ?? []).filter((r) => r.status === 'waitlisted');
  // Nothing to edit with an empty roster, so the toggle only appears once
  // someone has signed up.
  const hasAttendees = confirmed.length + waitlisted.length > 0;

  // Account holders get the richer /user profile; dependent personas open
  // their read-only person card. A registration with no resolvable person
  // (deleted or unreadable) simply isn't tappable.
  const profileHref = (r: Row) => {
    const userId = people[r.id]?.userId;
    if (userId) return `/user/${userId}`;
    return r.personId ? `/person/${r.personId}` : null;
  };

  const renderRow = (r: Row) => {
    const href = profileHref(r);
    // registeredAt is a required field on every stored registration; the guard
    // is for partially-mocked rows in tests, not for real data.
    const signedUpAt = r.registeredAt ? formatDate(r.registeredAt, 'datetime') : null;
    const identity = (
      <>
        <Avatar
          uri={people[r.id]?.photoURL ?? null}
          size={36}
          initials={r.name.slice(0, 1).toUpperCase()}
        />
        <VStack gap={0} className="flex-1">
          <Text numberOfLines={1}>{r.name}</Text>
          {signedUpAt ? (
            <Text
              testID={`attendee-signed-up-${r.id}`}
              variant="bodySm"
              tone="muted"
              numberOfLines={1}
              accessibilityLabel={t('event.signedUpAt', { date: signedUpAt })}
            >
              {signedUpAt}
            </Text>
          ) : null}
        </VStack>
      </>
    );
    return (
    <HStack key={r.id} gap={3} align="center" className="py-2">
      {href ? (
        <Pressable
          testID={`attendee-profile-${r.id}`}
          onPress={() => router.push(href as never)}
          accessibilityRole="button"
          accessibilityLabel={r.name}
          className="flex-1 flex-row items-center gap-3"
        >
          {identity}
        </Pressable>
      ) : (
        identity
      )}
      {requiresPayment ? (
        <Pressable
          testID={`paid-attendee-${r.id}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: r.paidAt != null }}
          accessibilityLabel={t('event.paid')}
          onPress={() => void togglePaid(r.id, r.paidAt == null)}
        >
          <Ionicons
            name={r.paidAt != null ? 'checkbox' : 'square-outline'}
            size={iconSizes.md}
            color={r.paidAt != null ? colors.light.fg.accent : colors.light.fg.muted}
          />
        </Pressable>
      ) : null}
      {telephoneRequired && phones[r.id] ? (
        <Pressable
          testID={`call-attendee-${r.id}`}
          accessibilityLabel={t('event.call')}
          onPress={() => setCallTarget({ name: r.name, phone: phones[r.id] ?? '' })}
        >
          <Ionicons name="call-outline" size={iconSizes.md} color={colors.light.fg.accent} />
        </Pressable>
      ) : null}
      {editing ? (
        <Pressable
          testID={`remove-attendee-${r.id}`}
          accessibilityLabel={t('common.delete')}
          hitSlop={8}
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
      ) : null}
    </HStack>
    );
  };

  return (
    <VStack gap={2}>
      <DetailSectionHeading
        action={
          hasAttendees ? (
            <SectionEditToggle
              testID="attendees-edit-toggle"
              editing={editing}
              onToggle={() => setEditing((e) => !e)}
            />
          ) : undefined
        }
      >
        {confirmed.length > 0 ? `${t('event.attendees')} (${confirmed.length})` : t('event.attendees')}
      </DetailSectionHeading>
      {rows && confirmed.length === 0 ? (
        <Text tone="muted" variant="bodySm">
          {t('event.attendeesEmpty')}
        </Text>
      ) : (
        confirmed.map(renderRow)
      )}

      {waitlisted.length > 0 ? (
        <VStack gap={2} className="mt-4">
          <DetailSectionHeading>{`${t('event.waitlist')} (${waitlisted.length})`}</DetailSectionHeading>
          {waitlisted.map(renderRow)}
        </VStack>
      ) : null}

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
