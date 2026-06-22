import { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import type { EventData } from '@cultuvilla/shared/models/event/EventDataModel';
import type { RegistrationData } from '@cultuvilla/shared/models/event/RegistrationDataModel';
import {
  getEventRegistrations,
  setRegistrationCheckIn,
  cancelRegistration,
  addWalkInRegistration,
  getRegistrationPhone,
} from '@cultuvilla/shared/services/registrationService';
import { updateEvent, updateEventStatus } from '@cultuvilla/shared/services/eventService';
import { VStack, HStack, Text, Button, Input, Pressable } from '../primitives';
import { useT } from '../../lib/i18n';

type Row = RegistrationData & { id: string };
type Ev = EventData & { id: string };

/**
 * Organizer-only event management console: edit core fields, cancel/complete,
 * and manage the attendee roster (check-in, remove, walk-in add, and the
 * organizer-only phone column when the event requires a phone).
 */
export function EventOrganizeConsole({ event }: { event: Ev }) {
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [phones, setPhones] = useState<Record<string, string | null>>({});
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [maxAttendees, setMaxAttendees] = useState(event.maxAttendees != null ? String(event.maxAttendees) : '');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const regs = await getEventRegistrations(event.id);
    setRows(regs);
    if (event.telephoneRequired) {
      const entries = await Promise.all(
        regs.map(async (r) => [r.id, await getRegistrationPhone(event.id, r.id)] as const),
      );
      setPhones(Object.fromEntries(entries));
    }
  }, [event.id, event.telephoneRequired]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveEdits() {
    setBusy(true);
    try {
      await updateEvent(event.id, {
        title: title.trim(),
        description: description.trim(),
        maxAttendees: maxAttendees.trim() ? Number(maxAttendees) : null,
      });
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: 'cancelled' | 'completed') {
    setBusy(true);
    try {
      await updateEventStatus(event.id, status);
    } finally {
      setBusy(false);
    }
  }

  async function addWalkIn() {
    if (!walkInName.trim()) return;
    setBusy(true);
    try {
      await addWalkInRegistration(event.id, walkInName.trim(), walkInPhone.trim() || undefined);
      setWalkInName('');
      setWalkInPhone('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <VStack gap={4} className="p-4">
      {/* Edit core fields */}
      <VStack gap={2}>
        <Text variant="h3">{t('event.editEvent')}</Text>
        <Input testID="event-title" value={title} onChangeText={setTitle} placeholder={t('event.title')} />
        <Input value={description} onChangeText={setDescription} placeholder={t('event.description')} multiline />
        <Input value={maxAttendees} onChangeText={setMaxAttendees} placeholder={t('event.maxAttendees')} keyboardType="number-pad" />
        <Button testID="save-event" onPress={saveEdits} loading={busy}>{t('common.save')}</Button>
      </VStack>

      {/* Lifecycle */}
      <HStack gap={2}>
        <Button testID="cancel-event" variant="danger" onPress={() => void setStatus('cancelled')}>{t('event.cancelled')}</Button>
        <Button testID="complete-event" variant="ghost" onPress={() => void setStatus('completed')}>{t('event.completed')}</Button>
      </HStack>

      {/* Walk-in */}
      <VStack gap={2}>
        <Text variant="h3">{t('event.attendees')}</Text>
        <HStack gap={2} align="center">
          <View className="flex-1">
            <Input testID="walkin-name" value={walkInName} onChangeText={setWalkInName} placeholder={t('event.title')} />
          </View>
          {event.telephoneRequired ? (
            <View className="flex-1">
              <Input testID="walkin-phone" value={walkInPhone} onChangeText={setWalkInPhone} placeholder={t('event.telephoneRequired')} keyboardType="phone-pad" />
            </View>
          ) : null}
          <Button testID="walkin-submit" onPress={addWalkIn} loading={busy} disabled={!walkInName.trim()}>{t('common.create')}</Button>
        </HStack>
      </VStack>

      {/* Roster */}
      <FlatList
        data={rows ?? []}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <View className="py-3 border-b border-subtle">
            <HStack gap={2} align="center">
              <View className="flex-1">
                <Text>{item.name}</Text>
                <Text className="text-muted text-xs">
                  {item.status === 'waitlisted' ? t('event.waitlisted') : t('event.confirmed')}
                  {item.checkedInAt ? ' · ✓' : ''}
                  {event.telephoneRequired && phones[item.id] ? ` · ${phones[item.id] ?? ''}` : ''}
                </Text>
              </View>
              <Pressable
                testID={`checkin-${item.id}`}
                onPress={() => void setRegistrationCheckIn(event.id, item.id, !item.checkedInAt).then(load)}
              >
                <Text className="text-green-700">{item.checkedInAt ? '↺' : '✓'}</Text>
              </Pressable>
              <Pressable
                testID={`remove-${item.id}`}
                onPress={() => void cancelRegistration(event.id, item.id).then(load)}
              >
                <Text className="text-red-600">{t('common.delete')}</Text>
              </Pressable>
            </HStack>
          </View>
        )}
        ListEmptyComponent={rows && rows.length === 0 ? <Text className="text-muted">{t('event.attendees')}</Text> : null}
      />
    </VStack>
  );
}
