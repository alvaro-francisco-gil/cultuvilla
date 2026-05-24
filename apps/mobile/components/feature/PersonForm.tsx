import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Avatar,
  Button,
  DateField,
  Input,
  Text,
  VStack,
  VillagePicker,
} from '../primitives';
import { useT } from '../../lib/i18n';
import type { PersonData, Sex } from '@cultuvilla/shared/models/person';

export interface PersonFormValues {
  givenName: string;
  firstSurname: string;
  secondSurname: string;
  nickname: string;
  sex: Sex | null;
  birthday: Date | null;
  birthPlaceMunicipalityId: string | null;
  biography: string;
}

export interface PersonFormPhoto {
  uri: string;
  blob: Blob;
}

export interface PersonFormProps {
  initial?: Partial<PersonFormValues> & { photoURL?: string | null };
  submitLabel: string;
  loading?: boolean;
  error?: string | null;
  onSubmit: (values: PersonFormValues, photo: PersonFormPhoto | null) => Promise<void> | void;
}

function fromPartialDate(d: PersonData['birthday']): Date | null {
  if (!d || d.year === null) return null;
  return new Date(d.year, (d.month ?? 1) - 1, d.day ?? 1);
}

async function pickImage(): Promise<PersonFormPhoto | null> {
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

export function PersonForm({
  initial,
  submitLabel,
  loading,
  error,
  onSubmit,
}: PersonFormProps) {
  const { t } = useT();
  const [photo, setPhoto] = useState<PersonFormPhoto | null>(null);
  const [givenName, setGivenName] = useState(initial?.givenName ?? '');
  const [firstSurname, setFirstSurname] = useState(initial?.firstSurname ?? '');
  const [secondSurname, setSecondSurname] = useState(initial?.secondSurname ?? '');
  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [sex, setSex] = useState<Sex | null>(initial?.sex ?? null);
  const [birthday, setBirthday] = useState<Date | null>(initial?.birthday ?? null);
  const [birthPlace, setBirthPlace] = useState<string | null>(
    initial?.birthPlaceMunicipalityId ?? null
  );
  const [biography, setBiography] = useState(initial?.biography ?? '');

  async function handleSubmit() {
    await onSubmit(
      {
        givenName,
        firstSurname,
        secondSurname,
        nickname,
        sex,
        birthday,
        birthPlaceMunicipalityId: birthPlace,
        biography,
      },
      photo
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <VStack gap={3}>
        <View className="items-center">
          <Avatar
            uri={photo?.uri ?? initial?.photoURL ?? undefined}
            size={96}
            onPress={async () => {
              const next = await pickImage();
              if (next) setPhoto(next);
            }}
          />
        </View>
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
      {error ? <Text tone="danger">{error}</Text> : null}
      <Button onPress={handleSubmit} loading={loading} fullWidth>
        {submitLabel}
      </Button>
    </ScrollView>
  );
}

PersonForm.fromPartialDate = fromPartialDate;
