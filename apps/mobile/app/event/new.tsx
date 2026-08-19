import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { router, useLocalSearchParams, Redirect } from 'expo-router';
import { Screen, Text, Input, DateTimeField, FieldLabel, InfoTooltip, Toggle, HStack, VStack, Pressable, ErrorState } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { EventCoverPicker } from '../../components/feature/EventCoverPicker';
import { LocationField } from '../../components/feature/LocationField';
import { MyVillagePicker, type VillageOption } from '../../components/feature/MyVillagePicker';
import { OrganizerPicker } from '../../components/feature/OrganizerPicker';
import { SignupQuestionsEditor } from '../../components/feature/signup/SignupQuestionsEditor';
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
import { useEntityCapabilities } from '../../lib/auth/useEntityCapabilities';
import { uploadEventImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import { buildLocationData } from '@cultuvilla/shared/models/core/LocationDataModel';
import {
  isUsableSignupField,
  type SignupFieldSpec,
} from '@cultuvilla/shared/models/event/SignupFieldModel';
import type { LatLng } from '@cultuvilla/shared/models/core/LocationDataModel';
import { Stepper, type StepConfig } from '../../components/feature/Stepper';
import { DeleteHeaderButton } from '../../components/feature/DeleteHeaderButton';
import { roundUpToMinuteStep } from '../../lib/date/clockGrid';
import { MAX_SIGNUP_GROUP_SIZE } from '@cultuvilla/shared/models/event/EventDataModel';

/** Every real group size — parejas, tríos, grupos de cuatro. Size 1 isn't a
 *  choice here: it's what the "inscripción por grupos" toggle being off means. */
const GROUP_SIZE_CHOICES = Array.from({ length: MAX_SIGNUP_GROUP_SIZE - 1 }, (_, i) => i + 2);

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

/**
 * A yes/no field, laid out exactly like `Input`: `FieldLabel` on its own line,
 * control underneath (see the primitive's `VStack gap={1}`). Every control in
 * the form reads the same way down the left edge, rather than switches being
 * right-aligned rows and text fields being stacked ones.
 *
 * The field's explanation lives behind an "ⓘ" instead of a paragraph under the
 * control — the Detalles step is a list of decisions, and spelling each one out
 * inline pushed the controls themselves below the fold.
 */
function ToggleField({
  label,
  help,
  value,
  onValueChange,
  disabled,
  testID,
}: {
  label: string;
  help?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  testID: string;
}) {
  const { t } = useT();
  return (
    <VStack gap={1}>
      <HStack gap={1} className="items-center">
        <FieldLabel>{label}</FieldLabel>
        {help ? <InfoTooltip title={label} text={help} testID={`${testID}-info`} /> : null}
      </HStack>
      <HStack gap={2} className="items-center">
        <Toggle
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          testID={testID}
        />
        <Text tone="muted">{value ? t('common.yes') : t('common.no')}</Text>
      </HStack>
    </VStack>
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
  const [startDate, setStartDate] = useState<Date | null>(() => roundUpToMinuteStep(new Date(), 5));
  // Optional multi-day end; null = single-day event.
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [locationName, setLocationName] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [telephoneRequired, setTelephoneRequired] = useState(false);
  const [requiresPayment, setRequiresPayment] = useState(false);
  // 1 = ordinary individual sign-up. Frozen once anyone has signed up: seats
  // already booked were seated against the old size (firestore.rules enforces
  // the same, see isFrozenGroupSizeChange).
  const [signupGroupSize, setSignupGroupSize] = useState(1);
  // Off = the event takes no sign-ups through the app (entrada libre, or a list
  // kept elsewhere). `signupInfo` then replaces the sign-up button on the
  // detail screen.
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [signupInfo, setSignupInfo] = useState('');
  // Default on: in a pueblo, seeing who is going is what drives sign-ups.
  const [attendeesPublic, setAttendeesPublic] = useState(true);
  const [signupFields, setSignupFields] = useState<SignupFieldSpec[]>([]);
  const [lockedFieldCount, setLockedFieldCount] = useState(0);
  const [groupSizeLocked, setGroupSizeLocked] = useState(false);
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
  const [createdBy, setCreatedBy] = useState<string | null>(null);
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
        setRequiresPayment(!!ev.requiresPayment);
        setSignupGroupSize(ev.signupGroupSize);
        setSignupEnabled(ev.signupEnabled !== false);
        setSignupInfo(ev.signupInfo ?? '');
        setAttendeesPublic(ev.attendeesVisibility !== 'organizers');
        setSignupFields(ev.signupFields ?? []);
        // Answers already collected are keyed by these ids, so once the event
        // has sign-ups the existing rows are frozen and only new ones can be
        // added. firestore.rules enforces the size half of the same invariant.
        setLockedFieldCount(ev.totalCount > 0 ? (ev.signupFields ?? []).length : 0);
        setGroupSizeLocked(ev.totalCount > 0);
        setOrganizerUserIds(ev.organizerUserIds ?? []);
        setCreatedBy(ev.createdBy);
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

  // Survives a failed cover upload so the retry patches the event that was
  // already created instead of creating another one. See the create branch.
  const createdEventIdRef = useRef<string | null>(null);

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
      // Half-finished rows (no label yet, or a select with no options to pick)
      // would be unanswerable, so they never reach the event doc. Locked rows
      // are kept verbatim — dropping one would break the additive-only rule.
      const usableSignupFields = signupFields
        .map((f) => ({
          ...f,
          label: f.label.trim(),
          // The options editor appends an empty row as you type; a blank option
          // is unanswerable and fails the model's `min(1)` on read.
          options: f.options.map((o) => o.trim()).filter((o) => o.length > 0),
        }))
        .filter((f, i) => i < lockedFieldCount || (f.label.length > 0 && isUsableSignupField(f)));

      // A note about signing up elsewhere is only meaningful with in-app
      // sign-ups off; EventFormSchema rejects the other combination.
      const signupInfoValue = signupInfo.trim() ? signupInfo.trim() : null;

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
          requiresPayment,
          signupEnabled,
          signupInfo: signupEnabled ? null : signupInfoValue,
          attendeesVisibility: attendeesPublic ? ('members' as const) : ('organizers' as const),
          signupFields: usableSignupFields,
          signupGroupSize,
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
      // Creating the event and uploading its cover are two round-trips, and the
      // upload is the one that fails on a weak link (a 5 MB image outlives the
      // Storage SDK's own retry budget). The event exists by then, so a retry
      // has to finish *that* event — re-running createEvent would leave the
      // user with a duplicate for every failed attempt. The id survives in a
      // ref for exactly as long as the form does.
      let newId = createdEventIdRef.current;
      if (!newId) {
        newId = await createEvent({
          title: title.trim(),
          description: description.trim(),
          startDate,
          endDate,
          location,
          maxAttendees: maxAttendeesValue,
          telephoneRequired,
          requiresPayment,
          signupEnabled,
          signupInfo: signupEnabled ? null : signupInfoValue,
          attendeesVisibility: attendeesPublic ? ('members' as const) : ('organizers' as const),
          signupFields: usableSignupFields,
          signupGroupSize,
          status: 'published',
          organizerUserIds,
          organizerOrgIds,
          createdBy: user.uid,
          municipalityId,
          villageName: municipalityName,
          villageCoordinates: municipalityCoordinates,
        });
        createdEventIdRef.current = newId;
      }
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
  const { canEdit, loading: capLoading } = useEntityCapabilities(municipalityId ?? undefined);

  const headerTitle = editMode ? t('event.editEvent') : t('event.createEvent');

  // Framed as delete but soft in practice: cancelling sets status → 'cancelled',
  // which the feeds already filter out (they query status == 'published'). Nav
  // must leave the event — returning to its detail would re-show the (still
  // existing) cancelled doc and read as "delete didn't work". Reaching edit mode
  // already implies organizer rights.
  const deleteEvent = () => {
    if (!eventId) return;
    return updateEventStatus(eventId, 'cancelled').then(() => router.replace('/(tabs)'));
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
    const notFound = loadError === 'not-found';
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={headerTitle} />
        <ErrorState
          error={notFound ? undefined : loadError}
          title={notFound ? t('event.notFoundTitle') : undefined}
          message={notFound ? t('event.notFoundBody') : undefined}
        />
      </Screen>
    );
  }

  // ── Edit: non-organizer redirect ──────────────────────────────────────────
  if (editMode && !capLoading && !canEdit(createdBy, organizerUserIds)) {
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
          <VStack gap={1}>
            <FieldLabel>{t('event.imageLabel')}</FieldLabel>
            <EventCoverPicker
              uri={cover?.previewUri ?? existingImageURL}
              label={cover || existingImageURL ? t('event.changeImage') : t('event.addImage')}
              onPress={async () => {
                const n = await pickImageAsBlob();
                if (n) setCover(n);
              }}
            />
          </VStack>
          <Input
            label={t('event.description')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
          />
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
            datePlaceholder={t('event.selectDate')}
            timePlaceholder={t('event.selectTime')}
            testID="startDate"
          />
          <DateTimeField
            label={t('event.endDateTime')}
            value={endDate}
            onChange={setEndDate}
            minimumDate={startDate ?? new Date()}
            datePlaceholder={t('event.selectDate')}
            timePlaceholder={t('event.selectTime')}
            testID="endDate"
          />
          <LocationField
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
          <ToggleField
            label={t('event.signupEnabled')}
            help={t('event.signupEnabledHint')}
            value={signupEnabled}
            onValueChange={setSignupEnabled}
            testID="signup-enabled"
          />
          {!signupEnabled ? (
            <Input
              label={t('event.signupInfo')}
              value={signupInfo}
              onChangeText={setSignupInfo}
              placeholder={t('event.signupInfoPlaceholder')}
              maxLength={200}
              testID="signup-info"
            />
          ) : null}
          {signupEnabled ? (
          <>
          <Input
            label={t('event.maxAttendees')}
            value={maxAttendees}
            onChangeText={setMaxAttendees}
            keyboardType="numeric"
          />
          <ToggleField
            label={t('event.telephoneRequired')}
            value={telephoneRequired}
            onValueChange={setTelephoneRequired}
            testID="telephone-required"
          />
          <ToggleField
            label={t('event.requiresPayment')}
            value={requiresPayment}
            onValueChange={setRequiresPayment}
            testID="requires-payment"
          />
          {/* Group sign-up is a yes/no first and a size second. Folding "1" into
              the size row made the common case (ordinary individual sign-up)
              look like a setting you had to understand before you could skip
              it. Turning it on picks the smallest real group; turning it off
              returns the event to 1. */}
          <ToggleField
            label={t('event.signupGroupSize')}
            help={t('event.signupGroupSizeHelp')}
            value={signupGroupSize > 1}
            onValueChange={(on) => setSignupGroupSize(on ? GROUP_SIZE_CHOICES[0]! : 1)}
            disabled={groupSizeLocked}
            testID="signup-group-size"
          />
          {signupGroupSize > 1 ? (
            <VStack gap={1}>
              <FieldLabel>{t('event.signupGroupSizeCount')}</FieldLabel>
              <HStack gap={2} className="items-center">
                {GROUP_SIZE_CHOICES.map((size) => {
                  const active = signupGroupSize === size;
                  return (
                    <Pressable
                      key={size}
                      testID={`group-size-${String(size)}`}
                      accessibilityRole="radio"
                      accessibilityLabel={`${t('event.signupGroupSizeCount')}: ${String(size)}`}
                      accessibilityState={{ selected: active, disabled: groupSizeLocked }}
                      disabled={groupSizeLocked}
                      onPress={() => setSignupGroupSize(size)}
                      className={`flex-1 items-center rounded-lg border py-2 ${
                        active ? 'border-accent bg-surface' : 'border-subtle'
                      } ${groupSizeLocked ? 'opacity-50' : ''}`}
                    >
                      <Text tone={active ? undefined : 'muted'}>{size}</Text>
                    </Pressable>
                  );
                })}
              </HStack>
            </VStack>
          ) : null}
          {/* Not tucked into the tooltip: this one explains why the control
              in front of you is dead, so it has to be visible. */}
          {groupSizeLocked ? (
            <Text variant="bodySm" tone="muted">
              {t('event.signupGroupSizeLocked')}
            </Text>
          ) : null}
          </>
          ) : null}
          <ToggleField
            label={t('event.attendeesPublic')}
            help={t('event.attendeesPublicHint')}
            value={attendeesPublic}
            onValueChange={setAttendeesPublic}
            testID="attendees-public"
          />
        </>,
      ),
    },
    // Custom sign-up questions are asked at sign-up time, so the step is
    // meaningless — and its answers unreachable — with in-app sign-ups off.
    ...(signupEnabled ? ([{
      key: 'questions',
      title: t('event.stepQuestions'),
      icon: 'help-circle-outline',
      // Half-finished questions are dropped on submit rather than blocking the
      // step: they are optional extras, and a creator who opened the step and
      // changed their mind shouldn't be trapped in it.
      render: () => stepBody(
        <SignupQuestionsEditor
          value={signupFields}
          onChange={setSignupFields}
          lockedCount={lockedFieldCount}
        />,
      ),
    }] as StepConfig[]) : []),
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
              deletingLabel={t('common.deleting.event')}
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
