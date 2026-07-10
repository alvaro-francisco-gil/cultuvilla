import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { router, useLocalSearchParams, Redirect } from 'expo-router';
import { Screen, Text, Input, DateTimeField, FieldLabel, Toggle, HStack } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { EventCoverPicker } from '../../components/feature/EventCoverPicker';
import { EventLocationField } from '../../components/feature/EventLocationField';
import { MyVillagePicker, type VillageOption } from '../../components/feature/MyVillagePicker';
import { OrganizerPicker } from '../../components/feature/OrganizerPicker';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { useCallable } from '../../lib/useCallable';
import { withFirestoreErrorLog } from '../../lib/firestoreErrorLog';
import { pickImageAsBlob } from '../../lib/images';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { escudoThumbDisplayUrl } from '@cultuvilla/shared/models/municipality';
import { getUserMemberships } from '@cultuvilla/shared/services/villageMemberService';
import { haversineKm } from '@cultuvilla/shared/services/feedService';
import { createEvent, updateEvent, getEvent, updateEventStatus } from '@cultuvilla/shared/services/eventService';
import { useEventOrganizer } from '../../lib/events/useEventOrganizer';
import { uploadEventImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import { buildLocationData } from '@cultuvilla/shared/models/core/LocationDataModel';
import type { LatLng } from '@cultuvilla/shared/models/core/LocationDataModel';
import { Stepper, type StepConfig } from '../../components/feature/Stepper';
import { DeleteHeaderButton } from '../../components/feature/DeleteHeaderButton';

/** Nearest joined village to a coordinate (by great-circle distance), or null. */
function nearestVillage(c: LatLng, villages: VillageOption[]): VillageOption | null {
  let best: VillageOption | null = null;
  let bestKm = Infinity;
  for (const v of villages) {
    if (!v.coordinates) continue;
    const km = haversineKm(c, v.coordinates);
    if (km < bestKm) {
      bestKm = km;
      best = v;
    }
  }
  return best;
}

function stepBody(children: React.ReactNode) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export default function NewEventScreen() {
  const { user, profile } = useAuth();
  const { t } = useT();
  // An `eventId` param puts the stepper in edit mode: it loads that event,
  // prefills every field, and saves via updateEvent. Otherwise it creates a new
  // event. A `villageId` param (e.g. from a village's "Próximos eventos" add
  // card) targets that village; otherwise fall back to the user's active one.
  const { villageId, eventId } = useLocalSearchParams<{ villageId?: string; eventId?: string }>();
  const editMode = !!eventId;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Existing cover URL (edit mode); replaced only if the user picks a new image.
  const [existingImageURL, setExistingImageURL] = useState<string | null>(null);

  // Village selection. The event's `municipalityId` must be a village the user
  // has joined (enforced by the create rule), so the dropdown is limited to
  // those. It auto-selects the nearest joined village to the picked location,
  // unless the user overrides it. In edit mode the municipality is immutable,
  // so we show the event's own village read-only.
  const [joinedVillages, setJoinedVillages] = useState<VillageOption[]>([]);
  const [selectedVillageId, setSelectedVillageId] = useState<string | null>(null);
  const [villageManuallyPicked, setVillageManuallyPicked] = useState(false);
  const [editMunicipalityId, setEditMunicipalityId] = useState<string | null>(null);
  const [editVillage, setEditVillage] = useState<VillageOption | null>(null);

  const municipalityId = editMode ? editMunicipalityId : selectedVillageId;
  const selectedVillage = editMode
    ? editVillage
    : (joinedVillages.find((v) => v.id === selectedVillageId) ?? null);
  const municipalityName = selectedVillage?.name ?? '';
  const municipalityCoordinates = selectedVillage?.coordinates ?? null;

  // form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  // Optional multi-day end; null = single-day event.
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [locationName, setLocationName] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [telephoneRequired, setTelephoneRequired] = useState(false);
  const [cover, setCover] = useState<UploadableImage | null>(null);

  // Picking a location auto-selects the nearest joined village (create mode,
  // until the user manually overrides the dropdown).
  function handleLocationChange(c: LatLng, address: string) {
    setCoords(c);
    setLocationName(address);
    if (!editMode && !villageManuallyPicked) {
      const nearest = nearestVillage(c, joinedVillages);
      if (nearest) setSelectedVillageId(nearest.id);
    }
  }

  // organizer state: creator always included.
  // Use an effect (not a one-shot initializer) so that if auth resolves after
  // the first render the creator's uid is still seeded.
  const [organizerUserIds, setOrganizerUserIds] = useState<string[]>([]);
  const [organizerOrgIds, setOrganizerOrgIds] = useState<string[]>([]);

  useEffect(() => {
    // Only auto-seed the creator when composing a new event. In edit mode the
    // organizer list is loaded from the event and must not gain the current
    // user (a village admin may be editing an event they don't organize).
    if (!user || editMode) return;
    setOrganizerUserIds((prev) =>
      prev.includes(user.uid) ? prev : [user.uid, ...prev],
    );
  }, [user, editMode]);

  // ── Edit mode: load the event and prefill every field ────────────────────
  useEffect(() => {
    if (!editMode || !eventId) return;
    let cancelled = false;
    async function load() {
      try {
        const ev = await withFirestoreErrorLog('event:getEvent', () => getEvent(eventId!));
        if (cancelled) return;
        if (!ev) {
          setLoadError('not-found');
          return;
        }
        setEditMunicipalityId(ev.municipalityId);
        setEditVillage({
          id: ev.municipalityId,
          name: ev.villageName ?? '',
          province: '',
          coordinates: ev.villageCoordinates ?? null,
          escudoThumbUrl: null,
        });
        setTitle(ev.title);
        setDescription(ev.description);
        setStartDate(ev.startDate);
        setEndDate(ev.endDate ?? null);
        setCoords(ev.location?.coordinates ?? null);
        setLocationName(ev.location?.displayName ?? '');
        setMaxAttendees(ev.maxAttendees != null ? String(ev.maxAttendees) : '');
        setTelephoneRequired(!!ev.telephoneRequired);
        setOrganizerUserIds(ev.organizerUserIds ?? []);
        setOrganizerOrgIds(ev.organizerOrgIds ?? []);
        setExistingImageURL(ev.imageURL ?? null);
        setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [editMode, eventId]);

  // ── Create mode: load the villages the user can post to ───────────────────
  useEffect(() => {
    if (editMode) return;
    let cancelled = false;
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const memberships = await withFirestoreErrorLog('event:getUserMemberships', () =>
          getUserMemberships(user.uid),
        );
        const munis = await Promise.all(
          memberships.map((m) => getMunicipality(m.municipalityId)),
        );
        if (cancelled) return;
        const options: VillageOption[] = munis
          .filter((m): m is NonNullable<typeof m> => m != null)
          .map((m) => ({
            id: m.id,
            name: m.name,
            province: m.province,
            coordinates: m.coordinates,
            escudoThumbUrl: escudoThumbDisplayUrl(m),
          }));
        setJoinedVillages(options);
        // Default selection: route param, then active village, then first joined.
        const preferred = villageId ?? profile?.activeMunicipalityId ?? null;
        setSelectedVillageId(
          options.find((o) => o.id === preferred)?.id ?? options[0]?.id ?? null,
        );
        setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [editMode, user, villageId, profile?.activeMunicipalityId]);

  const { fire: submit, isPending } = useCallable({
    callable: async () => {
      if (!municipalityId || !user || !startDate) return;
      const location = buildLocationData({
        // coords is validated non-null before submit() is reachable
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        coordinates: coords!,
        displayName: locationName.trim() || municipalityName,
      });
      const maxAttendeesValue = maxAttendees.trim() ? Number(maxAttendees) : null;

      // ── Edit: patch the existing event; only touch the cover if replaced ──
      if (editMode && eventId) {
        await updateEvent(eventId, {
          title: title.trim(),
          description: description.trim(),
          startDate,
          endDate,
          location,
          maxAttendees: maxAttendeesValue,
          telephoneRequired,
          organizerUserIds,
          organizerOrgIds,
        });
        if (cover) {
          const url = await uploadEventImage(municipalityId, eventId, {
            blob: cover.blob,
            filename: 'cover.jpg',
            contentType: cover.contentType,
          });
          await updateEvent(eventId, { imageURL: url });
        }
        return eventId;
      }

      // ── Create ────────────────────────────────────────────────────────────
      const newId = await createEvent({
        title: title.trim(),
        description: description.trim(),
        startDate,
        endDate,
        location,
        maxAttendees: maxAttendeesValue,
        telephoneRequired,
        status: 'published',
        organizerUserIds,
        organizerOrgIds,
        createdBy: user.uid,
        municipalityId,
        villageName: municipalityName,
        villageCoordinates: municipalityCoordinates,
      });
      if (cover) {
        const url = await uploadEventImage(municipalityId, newId, {
          blob: cover.blob,
          filename: 'cover.jpg',
          contentType: cover.contentType,
        });
        await updateEvent(newId, { imageURL: url });
      }
      return newId;
    },
    onSuccess: (id) => {
      if (id) router.replace(`/event/${id}`);
    },
    swallow: true,
  });

  // Edit mode is organizer-gated (mirrors the event update rules); a
  // non-organizer who deep-links here is sent back to the public detail.
  const { canOrganize, loading: organizerLoading } = useEventOrganizer(
    editMode && municipalityId ? { organizerUserIds, municipalityId } : null,
  );

  const headerTitle = editMode ? t('event.editEvent') : t('event.createEvent');

  // Framed as delete but soft in practice: cancelling sets status → 'cancelled',
  // which the feeds already filter out (they query status == 'published'). Nav
  // must leave the event — returning to its detail would re-show the (still
  // existing) cancelled doc and read as "delete didn't work". Reaching edit mode
  // already implies organizer rights.
  const deleteEvent = () => {
    if (!eventId) return;
    void updateEventStatus(eventId, 'cancelled').then(() => router.replace('/(tabs)'));
  };

  if (loading) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={headerTitle} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={headerTitle} />
        <View className="flex-1 items-center justify-center px-8">
          <Text tone="danger">{loadError}</Text>
        </View>
      </Screen>
    );
  }

  // ── Edit: non-organizer redirect ──────────────────────────────────────────
  if (editMode && !organizerLoading && !canOrganize) {
    return <Redirect href={`/event/${eventId}`} />;
  }

  // ── No active village (create only) ───────────────────────────────────────
  if (!municipalityId) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={headerTitle} />
        <View className="flex-1 items-center justify-center px-8">
          <Text tone="muted" className="text-center">
            {t('event.eligibility.body')}
          </Text>
        </View>
      </Screen>
    );
  }

  // ── Create / edit form ──────────────────────────────────────────────────
  const steps: StepConfig[] = [
    {
      key: 'basics',
      title: t('event.stepBasics'),
      icon: 'create-outline',
      validate: () => {
        const e: string[] = [];
        if (!title.trim()) e.push('title');
        return e;
      },
      render: () => stepBody(
        <>
          <Input label={t('event.title')} value={title} onChangeText={setTitle} testID="event-title" />
          <Input
            label={t('event.description')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
          />
          <FieldLabel>{t('event.imageLabel')}</FieldLabel>
          <EventCoverPicker
            uri={cover?.previewUri ?? existingImageURL}
            label={cover || existingImageURL ? t('event.changeImage') : t('event.addImage')}
            onPress={async () => {
              const n = await pickImageAsBlob();
              if (n) setCover(n);
            }}
          />
        </>,
      ),
    },
    {
      key: 'when',
      title: t('event.stepWhen'),
      icon: 'calendar-outline',
      validate: () => {
        const e: string[] = [];
        if (!startDate) e.push('startDate');
        // endDate is optional, but if set it must not precede startDate.
        if (endDate && startDate && endDate < startDate) e.push('endDate');
        if (!coords) e.push('coords');
        if (!municipalityId) e.push('village');
        return e;
      },
      render: () => stepBody(
        <>
          <DateTimeField
            label={t('event.startDateTime')}
            value={startDate}
            onChange={setStartDate}
            minimumDate={new Date()}
            placeholder={t('event.selectDateTime')}
            testID="startDate"
          />
          <DateTimeField
            label={t('event.endDateTime')}
            value={endDate}
            onChange={setEndDate}
            minimumDate={startDate ?? new Date()}
            placeholder={t('event.selectDateTime')}
            testID="endDate"
          />
          <EventLocationField
            value={coords}
            displayName={locationName}
            onChange={handleLocationChange}
            label={t('event.location')}
          />
          <MyVillagePicker
            label={t('event.village')}
            villages={editMode ? (editVillage ? [editVillage] : []) : joinedVillages}
            value={municipalityId}
            onChange={(id) => {
              setSelectedVillageId(id);
              setVillageManuallyPicked(true);
            }}
            disabled={editMode}
          />
        </>,
      ),
    },
    {
      key: 'details',
      title: t('event.stepDetails'),
      icon: 'options-outline',
      render: () => stepBody(
        <>
          {municipalityId && user ? (
            <OrganizerPicker
              municipalityId={municipalityId}
              selectedUserIds={organizerUserIds}
              selectedOrgIds={organizerOrgIds}
              lockedUserId={user.uid}
              onChangeUsers={setOrganizerUserIds}
              onChangeOrgs={setOrganizerOrgIds}
            />
          ) : null}
          <Input
            label={t('event.maxAttendees')}
            value={maxAttendees}
            onChangeText={setMaxAttendees}
            keyboardType="numeric"
          />
          <HStack className="items-center justify-between py-1">
            <Text className="flex-1">{t('event.telephoneRequired')}</Text>
            <HStack gap={2} className="items-center">
              <Text tone="muted">{telephoneRequired ? t('common.yes') : t('common.no')}</Text>
              <Toggle
                value={telephoneRequired}
                onValueChange={setTelephoneRequired}
                testID="telephone-required"
              />
            </HStack>
          </HStack>
        </>,
      ),
    },
  ];

  // bottomInset={false}: the Stepper's own bottom nav bar applies the safe-area inset.
  return (
    <Screen padded={false} bottomInset={false} topInset={false}>
      <ScreenHeader
        accent
        title={headerTitle}
        rightSlot={
          editMode ? (
            <DeleteHeaderButton
              onAccent
              onConfirm={deleteEvent}
              accessibilityLabel={t('common.delete')}
              confirmTitle={t('event.cancelTitle')}
              confirmMessage={t('event.cancelConfirm')}
              confirmLabel={t('common.delete')}
              cancelLabel={t('common.cancel')}
            />
          ) : undefined
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Stepper
          steps={steps}
          onComplete={() => void submit()}
          submitLabel={editMode ? t('common.save') : t('event.createEvent')}
          loading={isPending}
          allStepsReachable={editMode}
          primaryTestID="event-form-primary"
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
