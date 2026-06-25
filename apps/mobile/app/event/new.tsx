import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Text, Input, Button, DateField, ImagePickerField, FieldLabel } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { useCallable } from '../../lib/useCallable';
import { withFirestoreErrorLog } from '../../lib/firestoreErrorLog';
import { pickImageAsBlob } from '../../lib/images';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import {
  getOrganizationsByMunicipality,
} from '@cultuvilla/shared/services/organizationService';
import { getOrgMembershipsByUserInMunicipality } from '@cultuvilla/shared/services/orgMemberService';
import { createEvent, updateEvent } from '@cultuvilla/shared/services/eventService';
import { uploadEventImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import { buildLocationData } from '@cultuvilla/shared/models/core/LocationDataModel';
import type { LatLng } from '@cultuvilla/shared/models/core/LocationDataModel';
import { Stepper, type StepConfig } from '../../components/feature/Stepper';

type MemberOrg = { id: string; name: string };

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
  // A `villageId` param (e.g. from a village's "Próximos eventos" add card)
  // targets that village; otherwise fall back to the user's active one.
  const { villageId } = useLocalSearchParams<{ villageId?: string }>();
  const municipalityId = villageId ?? profile?.activeMunicipalityId ?? null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [municipalityName, setMunicipalityName] = useState('');
  const [municipalityCoordinates, setMunicipalityCoordinates] = useState<LatLng | null>(null);
  const [memberOrgs, setMemberOrgs] = useState<MemberOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [locationText, setLocationText] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [telephoneRequired, setTelephoneRequired] = useState(false);
  const [cover, setCover] = useState<UploadableImage | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!municipalityId || !user) {
        setLoading(false);
        return;
      }
      try {
        const [mun, orgs] = await Promise.all([
          withFirestoreErrorLog('event:getMunicipality', () => getMunicipality(municipalityId)),
          withFirestoreErrorLog('event:getOrganizationsByMunicipality', () =>
            getOrganizationsByMunicipality(municipalityId),
          ),
        ]);
        const memberships = await withFirestoreErrorLog('event:getOrgMemberships', () =>
          getOrgMembershipsByUserInMunicipality(
            user.uid,
            municipalityId,
            orgs.map((o) => o.id),
          ),
        );
        if (cancelled) return;
        const memberOrgIds = new Set(memberships.map((m) => m.orgId));
        const mine = orgs
          .filter((o) => memberOrgIds.has(o.id))
          .map((o) => ({ id: o.id, name: o.name }));
        setMunicipalityName(mun?.name ?? '');
        setMunicipalityCoordinates(mun?.coordinates ?? null);
        setMemberOrgs(mine);
        setSelectedOrgId(null);
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
  }, [municipalityId, user]);

  const selectedOrg = memberOrgs.find((o) => o.id === selectedOrgId) ?? null;

  const { fire: submit, isPending } = useCallable({
    callable: async () => {
      if (!municipalityId || !user || !startDate) return;
      const eventId = await createEvent({
        title: title.trim(),
        description: description.trim(),
        startDate,
        endDate: endDate ?? null,
        location: buildLocationData({ type: 'text', text: locationText.trim() || null }),
        maxAttendees: maxAttendees.trim() ? Number(maxAttendees) : null,
        telephoneRequired,
        status: 'published',
        organizationId: selectedOrg?.id ?? null,
        organizationName: selectedOrg?.name ?? null,
        createdBy: user.uid,
        municipalityId,
        municipalityName,
        municipalityCoordinates,
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
    },
    onSuccess: (eventId) => {
      if (eventId) router.replace(`/event/${eventId}`);
    },
    swallow: true,
  });

  // ── No active village ───────────────────────────────────────────────────
  if (!municipalityId) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={t('event.createEvent')} />
        <View className="flex-1 items-center justify-center px-8">
          <Text tone="muted" className="text-center">
            {t('event.eligibility.body')}
          </Text>
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={t('event.createEvent')} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={t('event.createEvent')} />
        <View className="flex-1 items-center justify-center px-8">
          <Text tone="danger">{loadError}</Text>
        </View>
      </Screen>
    );
  }

  // ── Create form ───────────────────────────────────────────────────────────
  const steps: StepConfig[] = [
    {
      key: 'basics',
      title: t('event.stepBasics'),
      icon: 'create-outline',
      validate: () => {
        const e: string[] = [];
        if (!title.trim()) e.push('title');
        if (!description.trim()) e.push('description');
        return e;
      },
      render: () => stepBody(
        <>
          <Input label={t('event.title')} value={title} onChangeText={setTitle} />
          <Input
            label={t('event.description')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
          />
          <FieldLabel>{t('event.imageLabel')}</FieldLabel>
          <ImagePickerField
            uri={cover?.previewUri ?? null}
            width="100%"
            height={160}
            label={cover ? t('event.changeImage') : t('event.addImage')}
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
      validate: () => (startDate ? [] : ['startDate']),
      render: () => stepBody(
        <>
          <DateField
            label={t('event.startDate')}
            value={startDate}
            onChange={setStartDate}
            testID="startDate"
          />
          <DateField
            label={t('event.endDate')}
            value={endDate}
            onChange={setEndDate}
            testID="endDate"
          />
          <Input label={t('event.location')} value={locationText} onChangeText={setLocationText} />
        </>,
      ),
    },
    {
      key: 'details',
      title: t('event.stepDetails'),
      icon: 'options-outline',
      render: () => stepBody(
        <>
          <FieldLabel>{t('event.organizationLabel')}</FieldLabel>
          <Button
            variant={selectedOrgId === null ? 'primary' : 'secondary'}
            onPress={() => setSelectedOrgId(null)}
          >
            {t('event.noOrganization')}
          </Button>
          {memberOrgs.map((o) => (
            <Button
              key={o.id}
              variant={selectedOrgId === o.id ? 'primary' : 'secondary'}
              onPress={() => setSelectedOrgId(o.id)}
            >
              {o.name}
            </Button>
          ))}
          {memberOrgs.length === 0 && (
            <Button
              variant="secondary"
              onPress={() => router.push(`/discover/organize/${municipalityId}` as never)}
            >
              {t('event.eligibility.requestOrganizer')}
            </Button>
          )}
          <Input
            label={t('event.maxAttendees')}
            value={maxAttendees}
            onChangeText={setMaxAttendees}
            keyboardType="numeric"
          />
          <Button
            variant={telephoneRequired ? 'primary' : 'secondary'}
            onPress={() => setTelephoneRequired((v) => !v)}
          >
            {t('event.telephoneRequired')}
          </Button>
        </>,
      ),
    },
  ];

  // bottomInset={false}: the Stepper's own bottom nav bar applies the safe-area inset.
  return (
    <Screen padded={false} bottomInset={false} topInset={false}>
      <ScreenHeader accent title={t('event.createEvent')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Stepper steps={steps} onComplete={() => void submit()} submitLabel={t('event.createEvent')} loading={isPending} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
