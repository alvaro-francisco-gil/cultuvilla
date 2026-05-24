import { useState } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Screen,
  VStack,
  Text,
  Input,
  Button,
  Avatar,
  DateField,
  VillagePicker,
} from '../../components/primitives';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import {
  createPerson,
  updatePerson,
  getPersonByUserId,
} from '@cultuvilla/shared/services/personService';
import {
  createUserProfile,
  patchUserProfile,
} from '@cultuvilla/shared/services/userService';
import { uploadPersonImage } from '@cultuvilla/shared/services/imageService';
import type { Sex, PartialDate, MunicipalityLink } from '@cultuvilla/shared/models/person';

function toPartialDate(d: Date | null): PartialDate | null {
  if (!d) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function buildDisplayName(given: string, first: string, second: string): string {
  return [given, first, second].map((s) => s.trim()).filter(Boolean).join(' ');
}

async function pickImage(): Promise<{ uri: string; blob: Blob } | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  return { uri: asset.uri, blob };
}

export default function CompleteProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useT();

  const [photo, setPhoto] = useState<{ uri: string; blob: Blob } | null>(null);
  const [givenName, setGivenName] = useState('');
  const [firstSurname, setFirstSurname] = useState('');
  const [secondSurname, setSecondSurname] = useState('');
  const [nickname, setNickname] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [birthPlace, setBirthPlace] = useState<string | null>(null);
  const [biography, setBiography] = useState('');

  const [telephone, setTelephone] = useState(profile?.telephone ?? '');
  const [accountVillage, setAccountVillage] = useState<string | null>(profile?.activeMunicipalityId ?? null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!user) return;
    setError(null);
    const trimmedGiven = givenName.trim();
    const trimmedFirst = firstSurname.trim();
    const trimmedSecond = secondSurname.trim();
    if (!trimmedGiven || !trimmedFirst || !trimmedSecond || !birthday) {
      setError(t('onboarding.completeProfile.requiredFields'));
      return;
    }
    const displayName = buildDisplayName(trimmedGiven, trimmedFirst, trimmedSecond);
    setLoading(true);
    try {
      const birthPlaceLink: MunicipalityLink | null = birthPlace
        ? { municipalityId: birthPlace, barrioId: null }
        : null;

      let personId: string;
      if (profile?.personId) {
        personId = profile.personId;
      } else {
        const existing = await getPersonByUserId(user.uid);
        if (existing) {
          personId = existing.id;
        } else {
          personId = await createPerson({
            givenName: trimmedGiven,
            firstSurname: trimmedFirst,
            secondSurname: trimmedSecond,
            nickname: nickname.trim() || null,
            sex,
            birthday: toPartialDate(birthday),
            birthPlace: birthPlaceLink,
            biography: biography.trim() || null,
            userId: user.uid,
            createdBy: user.uid,
          });
        }
      }

      if (photo) {
        const url = await uploadPersonImage(personId, {
          blob: photo.blob,
          filename: `avatar-${Date.now()}.jpg`,
          contentType: photo.blob.type || 'image/jpeg',
        });
        await updatePerson(personId, { photoURL: url });
      }

      if (profile) {
        await patchUserProfile(user.uid, {
          displayName,
          telephone: telephone.trim() || null,
          activeMunicipalityId: accountVillage,
          personId,
        });
      } else {
        await createUserProfile(user.uid, {
          displayName,
          email: user.email ?? '',
          telephone: telephone.trim() || null,
          activeMunicipalityId: accountVillage,
          personId,
        });
      }

      await refreshProfile();
      router.replace({ pathname: '/(tabs)' });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('onboarding.completeProfile.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text variant="h2">{t('onboarding.completeProfile.title')}</Text>

        <VStack gap={3}>
          <Input
            label={t('onboarding.completeProfile.givenName')}
            value={givenName}
            onChangeText={setGivenName}
          />
          <Input
            label={t('onboarding.completeProfile.firstSurname')}
            value={firstSurname}
            onChangeText={setFirstSurname}
          />
          <Input
            label={t('onboarding.completeProfile.secondSurname')}
            value={secondSurname}
            onChangeText={setSecondSurname}
          />
          <Text tone="muted">{t('onboarding.completeProfile.photo')}</Text>
          <Avatar
            uri={photo?.uri}
            size={96}
            onPress={async () => {
              const next = await pickImage();
              if (next) setPhoto(next);
            }}
          />
          <Input
            label={t('onboarding.completeProfile.nickname')}
            value={nickname}
            onChangeText={setNickname}
          />
          <Text tone="muted">{t('onboarding.completeProfile.sex')}</Text>
          <VStack gap={2}>
            {(['female', 'male', 'other'] as const).map((opt) => (
              <Button
                key={opt}
                variant={sex === opt ? 'primary' : 'secondary'}
                onPress={() => setSex(sex === opt ? null : opt)}
              >
                {t(`onboarding.completeProfile.sex_${opt}`)}
              </Button>
            ))}
          </VStack>
          <DateField
            label={t('onboarding.completeProfile.birthday')}
            value={birthday}
            onChange={setBirthday}
            minimumDate={new Date(1900, 0, 1)}
            maximumDate={new Date()}
            testID="birthday"
          />
          <VillagePicker
            label={t('onboarding.completeProfile.birthPlace')}
            value={birthPlace}
            onChange={setBirthPlace}
          />
          <Input
            label={t('onboarding.completeProfile.biography')}
            value={biography}
            onChangeText={setBiography}
            multiline
            numberOfLines={4}
          />
        </VStack>

        <Text variant="h3">{t('onboarding.completeProfile.accountSection')}</Text>
        <VStack gap={3}>
          <Input
            label={t('onboarding.completeProfile.telephone')}
            value={telephone}
            onChangeText={setTelephone}
            keyboardType="phone-pad"
          />
          <VillagePicker
            label={t('onboarding.completeProfile.village')}
            value={accountVillage}
            onChange={setAccountVillage}
          />
        </VStack>

        {error && <Text tone="danger">{error}</Text>}
        <Button onPress={onSubmit} loading={loading} fullWidth>
          {t('onboarding.completeProfile.submit')}
        </Button>
      </ScrollView>
    </Screen>
  );
}
