import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Text } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { PersonForm } from '../../components/feature/PersonForm';
import type { PersonFormPhoto, PersonFormValues } from '../../components/feature/PersonForm';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import {
  createPerson,
  getPerson,
  updatePerson,
} from '@cultuvilla/shared/services/personService';
import { uploadUserPhoto } from '@cultuvilla/shared/services/imageService';
import type { MunicipalityLink, PartialDate, PersonData } from '@cultuvilla/shared/models/person';

type PersonDoc = PersonData & { id: string };

function toPartialDate(d: Date | null): PartialDate | null {
  if (!d) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function partialDateToDate(d: PartialDate | null): Date | null {
  if (!d || d.year === null) return null;
  return new Date(d.year, (d.month ?? 1) - 1, d.day ?? 1);
}

export default function PersonDetailScreen() {
  const { personId } = useLocalSearchParams<{ personId: string }>();
  const { user } = useAuth();
  const { t } = useT();
  const isNew = personId === 'new';

  const [person, setPerson] = useState<PersonDoc | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !personId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getPerson(personId)
      .then((p) => {
        if (!cancelled) setPerson(p);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [personId, isNew]);

  async function onSubmit(values: PersonFormValues, photo: PersonFormPhoto | null) {
    if (!user) return;
    if (!values.givenName.trim() || !values.firstSurname.trim()) {
      setError(t('onboarding.completeProfile.requiredFields'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const birthPlaceLink: MunicipalityLink | null = values.birthPlaceMunicipalityId
        ? { municipalityId: values.birthPlaceMunicipalityId, barrioId: null }
        : null;

      let pid: string;
      if (isNew) {
        pid = await createPerson({
          givenName: values.givenName.trim(),
          firstSurname: values.firstSurname.trim() || null,
          secondSurname: values.secondSurname.trim() || null,
          nickname: values.nickname.trim() || null,
          sex: values.sex,
          birthday: toPartialDate(values.birthday),
          birthPlace: birthPlaceLink,
          biography: values.biography.trim() || null,
          createdBy: user.uid,
        });
      } else {
        if (!person) return;
        pid = person.id;
        await updatePerson(pid, {
          givenName: values.givenName.trim(),
          firstSurname: values.firstSurname.trim() || null,
          secondSurname: values.secondSurname.trim() || null,
          nickname: values.nickname.trim() || null,
          sex: values.sex,
          birthday: toPartialDate(values.birthday),
          birthPlace: birthPlaceLink,
          biography: values.biography.trim() || null,
        });
      }

      if (photo) {
        // Always upload to the user-scoped path (rule: auth.uid == userId).
        // The person-scoped path needs a cross-service firestore.get the live
        // project can't resolve, so it 403s when editing an existing person.
        const url = await uploadUserPhoto(user.uid, {
          blob: photo.blob,
          filename: `avatar-${Date.now()}.jpg`,
          contentType: photo.blob.type || 'image/jpeg',
        });
        await updatePerson(pid, { photoURL: url });
      }

      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    } finally {
      setSaving(false);
    }
  }

  const initial = person
    ? {
        givenName: person.givenName,
        firstSurname: person.firstSurname ?? '',
        secondSurname: person.secondSurname ?? '',
        nickname: person.nickname ?? '',
        sex: person.sex,
        birthday: partialDateToDate(person.birthday),
        birthPlaceMunicipalityId: person.birthPlace?.municipalityId ?? null,
        biography: person.biography ?? '',
        photoURL: person.photoURL,
      }
    : undefined;

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('profile.personDetailTitle')} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : !isNew && !person ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text tone="muted">404</Text>
        </View>
      ) : (
        <PersonForm
          initial={initial}
          submitLabel={isNew ? t('profile.personasSection.add') : t('profile.personEdit')}
          loading={saving}
          error={error}
          onSubmit={onSubmit}
        />
      )}
    </Screen>
  );
}
