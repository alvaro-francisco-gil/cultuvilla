import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Screen, VStack, Text, Input, Button, DateField } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { useCallable } from '../../lib/useCallable';
import { withFirestoreErrorLog } from '../../lib/firestoreErrorLog';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import {
  getOrganizationsByMunicipality,
} from '@cultuvilla/shared/services/organizationService';
import { getOrgMembershipsByUserInMunicipality } from '@cultuvilla/shared/services/orgMemberService';
import { createEvent, updateEvent } from '@cultuvilla/shared/services/eventService';
import { uploadEventImage } from '@cultuvilla/shared/services/imageService';
import { buildLocationData } from '@cultuvilla/shared/models/core/LocationDataModel';
import type { LatLng } from '@cultuvilla/shared/models/core/LocationDataModel';

type MemberOrg = { id: string; name: string };
type PickedImage = { uri: string; blob: Blob };

async function pickImage(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  return { uri: asset.uri, blob };
}

export default function NewEventScreen() {
  const { user, profile } = useAuth();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const municipalityId = profile?.activeMunicipalityId ?? null;

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
  const [price, setPrice] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [telephoneRequired, setTelephoneRequired] = useState(false);
  const [cover, setCover] = useState<PickedImage | null>(null);

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
        setSelectedOrgId(mine[0]?.id ?? null);
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
  const canSubmit =
    !!municipalityId && !!user && !!selectedOrg && title.trim().length > 0 &&
    description.trim().length > 0 && !!startDate;

  const { fire: submit, isPending } = useCallable({
    callable: async () => {
      if (!municipalityId || !user || !selectedOrg || !startDate) return;
      const eventId = await createEvent({
        title: title.trim(),
        description: description.trim(),
        startDate,
        endDate: endDate ?? null,
        location: buildLocationData({ type: 'text', text: locationText.trim() || null }),
        price: price.trim() ? Number(price) : null,
        maxAttendees: maxAttendees.trim() ? Number(maxAttendees) : null,
        telephoneRequired,
        status: 'draft',
        organizationId: selectedOrg.id,
        organizationName: selectedOrg.name,
        createdBy: user.uid,
        municipalityId,
        municipalityName,
        municipalityCoordinates,
      });
      if (cover) {
        const url = await uploadEventImage(municipalityId, eventId, {
          blob: cover.blob,
          filename: 'cover.jpg',
          contentType: cover.blob.type || 'image/jpeg',
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
      <Screen padded={false}>
        <ScreenHeader title={t('event.createEvent')} />
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
      <Screen padded={false}>
        <ScreenHeader title={t('event.createEvent')} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen padded={false}>
        <ScreenHeader title={t('event.createEvent')} />
        <View className="flex-1 items-center justify-center px-8">
          <Text tone="danger">{loadError}</Text>
        </View>
      </Screen>
    );
  }

  // ── Not a member of any organization → eligibility prompt ─────────────────
  if (memberOrgs.length === 0) {
    return (
      <Screen padded={false}>
        <ScreenHeader title={t('event.createEvent')} />
        <View className="flex-1 items-center justify-center px-8">
          <VStack gap={4} className="items-center">
            <Text className="text-center">{t('event.eligibility.body')}</Text>
            <Button
              fullWidth
              onPress={() => router.push(`/discover/request-organizer/${municipalityId}` as never)}
            >
              {t('event.eligibility.requestOrganizer')}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onPress={() => router.push(`/village/${municipalityId}/organizations` as never)}
            >
              {t('event.eligibility.browseOrgs')}
            </Button>
          </VStack>
        </View>
      </Screen>
    );
  }

  // ── Create form ───────────────────────────────────────────────────────────
  // bottomInset={false}: the ScrollView below applies insets.bottom itself.
  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title={t('event.createEvent')} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 80 }}
          keyboardShouldPersistTaps="handled"
        >
          {memberOrgs.length > 1 && (
            <>
              <Text tone="muted">{t('event.organizationLabel')}</Text>
              <VStack gap={2}>
                {memberOrgs.map((o) => (
                  <Button
                    key={o.id}
                    variant={selectedOrgId === o.id ? 'primary' : 'secondary'}
                    onPress={() => setSelectedOrgId(o.id)}
                  >
                    {o.name}
                  </Button>
                ))}
              </VStack>
            </>
          )}
          <Input label={t('event.title')} value={title} onChangeText={setTitle} />
          <Input
            label={t('event.description')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
          />
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
          <Input
            label={t('event.price')}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
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
          <Text tone="muted">{t('event.imageLabel')}</Text>
          {cover && (
            <Image
              source={{ uri: cover.uri }}
              style={{ width: '100%', height: 160, borderRadius: 8 }}
              accessibilityIgnoresInvertColors
            />
          )}
          <Button
            variant="secondary"
            onPress={async () => {
              const next = await pickImage();
              if (next) setCover(next);
            }}
          >
            {cover ? t('event.changeImage') : t('event.addImage')}
          </Button>
          <Button
            onPress={() => void submit()}
            loading={isPending}
            disabled={!canSubmit}
            fullWidth
          >
            {t('event.createEvent')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
