import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  BarrioPicker,
  Button,
  DateField,
  HStack,
  Input,
  Pressable,
  Text,
  VStack,
  VillagePicker,
} from '../primitives';
import { useT } from '../../lib/i18n';
import { pickImageAsBlob } from '../../lib/images';
import type { Sex } from '@cultuvilla/shared/models/person';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import { Stepper, type StepConfig } from './Stepper';

export interface PersonFormValues {
  givenName: string;
  firstSurname: string;
  secondSurname: string;
  nickname: string;
  sex: Sex | null;
  birthday: Date | null;
  birthPlaceMunicipalityId: string | null;
  /** Residence village → stored as the person's municipalityLinks. */
  municipalityId: string | null;
  /** Residence barrio within `municipalityId`; null = whole village. */
  barrioId: string | null;
  biography: string;
}

/** Avatar photo picked in the form. Aliases the shared UploadableImage so the
 * form and the proposable surfaces share one image-input path (pickImageAsBlob). */
export type PersonFormPhoto = UploadableImage;

export interface PersonFormProps {
  initial?: Partial<PersonFormValues> & { photoURL?: string | null };
  submitLabel: string;
  loading?: boolean;
  error?: string | null;
  requireFullName?: boolean;
  onSubmit: (values: PersonFormValues, photo: PersonFormPhoto | null) => Promise<void> | void;
}

export function PersonForm({
  initial,
  submitLabel,
  loading,
  error,
  requireFullName = false,
  onSubmit,
}: PersonFormProps) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
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
  const [municipalityId, setMunicipalityId] = useState<string | null>(
    initial?.municipalityId ?? null
  );
  const [barrioId, setBarrioId] = useState<string | null>(initial?.barrioId ?? null);
  const [biography, setBiography] = useState(initial?.biography ?? '');

  // A barrio only makes sense within its village, so changing the village
  // clears any previously selected barrio.
  function handleVillageChange(id: string | null) {
    setMunicipalityId(id);
    setBarrioId(null);
  }

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
        municipalityId,
        barrioId,
        biography,
      },
      photo
    );
  }

  function stepBody(children: ReactNode) {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <VStack gap={3}>{children}</VStack>
      </ScrollView>
    );
  }

  const steps: StepConfig[] = [
    {
      key: 'identity',
      title: t('profile.personForm.stepIdentity'),
      icon: 'person-outline',
      validate: () => {
        const errs: string[] = [];
        if (!givenName.trim()) errs.push('givenName');
        if (requireFullName && !firstSurname.trim()) errs.push('firstSurname');
        if (requireFullName && !secondSurname.trim()) errs.push('secondSurname');
        if (!sex) errs.push('sex');
        return errs;
      },
      render: () =>
        stepBody(
          <>
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
            <VStack gap={1}>
              <Text variant="bodySm" tone="muted">
                {t('onboarding.completeProfile.sex')}
              </Text>
              <HStack gap={2}>
                {(['female', 'male', 'other'] as const).map((opt) => {
                  const active = sex === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => setSex(opt)}
                      accessibilityLabel={t(`onboarding.completeProfile.sex_${opt}`)}
                      className={`flex-1 py-2.5 rounded-md border items-center justify-center ${
                        active ? 'bg-accent border-accent' : 'bg-surface border-subtle'
                      }`}
                    >
                      <Text variant="bodySm" tone={active ? 'onAccent' : 'primary'}>
                        {t(`onboarding.completeProfile.sex_${opt}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </HStack>
            </VStack>
          </>,
        ),
    },
    {
      key: 'residence',
      title: t('profile.personForm.stepResidence'),
      icon: 'location-outline',
      validate: () => (requireFullName && !birthday ? ['birthday'] : []),
      render: () =>
        stepBody(
          <>
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
            <VillagePicker
              label={t('profile.personForm.village')}
              value={municipalityId}
              onChange={handleVillageChange}
            />
            <BarrioPicker
              label={t('profile.personForm.barrio')}
              municipalityId={municipalityId}
              value={barrioId}
              onChange={setBarrioId}
              wholeVillageLabel={t('profile.personForm.wholeVillage')}
            />
          </>,
        ),
    },
    {
      key: 'about',
      title: t('profile.personForm.stepAbout'),
      icon: 'document-text-outline',
      render: () =>
        stepBody(
          <>
            <Input
              label={t('onboarding.completeProfile.biography')}
              value={biography}
              onChangeText={setBiography}
              multiline
              numberOfLines={4}
            />
            <Text tone="muted">{t('profile.personForm.photo')}</Text>
            <View className="items-center">
              <Avatar
                uri={photo?.previewUri ?? initial?.photoURL ?? undefined}
                size={96}
                onPress={async () => {
                  const next = await pickImageAsBlob({ square: true });
                  if (next) setPhoto(next);
                }}
              />
            </View>
          </>,
        ),
    },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stepper
        steps={steps}
        onComplete={handleSubmit}
        submitLabel={submitLabel}
        loading={loading}
        submitError={error}
      />
    </KeyboardAvoidingView>
  );
}
