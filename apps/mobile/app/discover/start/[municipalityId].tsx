import { useEffect, useRef, useState } from 'react';
import { ScrollView, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, VStack, HStack, Text, Input, Button } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth/useAuth';
import { useCallable } from '../../../lib/useCallable';
import { startVillage } from '@cultuvilla/shared/services/municipalityService';
import { requestOrganizeVillage } from '@cultuvilla/shared/services/organizerRequestService';
import { patchUserProfile } from '@cultuvilla/shared/services/userService';

/**
 * "Start this village" — self-service activation of a dormant municipality.
 * Activating it makes the village joinable and adds the starter as its first
 * member; it does NOT make them the organizer. The optional toggle files an
 * organizer request in the same flow (still superadmin-approved). When the
 * user opts to organize, we capture a contact phone (stored on their profile)
 * and their motivation alongside the request.
 */
export default function StartVillageScreen() {
  const { municipalityId } = useLocalSearchParams<{ municipalityId: string }>();
  const { t } = useT();
  const { user, profile } = useAuth();
  const [description, setDescription] = useState('');
  const [wantOrganize, setWantOrganize] = useState(false);
  const [phone, setPhone] = useState('');
  const [motivation, setMotivation] = useState('');

  // Prefill the phone once from the profile so the user can verify/correct it.
  const prefilled = useRef(false);
  useEffect(() => {
    if (!prefilled.current && profile?.telephone) {
      setPhone(profile.telephone);
      prefilled.current = true;
    }
  }, [profile?.telephone]);

  const phoneMissing = wantOrganize && phone.trim().length === 0;

  const { fire: submit, isPending } = useCallable({
    callable: async () => {
      const id = municipalityId ?? '';
      await startVillage({ municipalityId: id, description: description.trim() });
      if (wantOrganize) {
        if (user) await patchUserProfile(user.uid, { telephone: phone.trim() });
        await requestOrganizeVillage({ municipalityId: id, motivation: motivation.trim() || null });
      }
    },
    onSuccess: () => {
      router.replace({
        pathname: '/village/[villageId]',
        params: { villageId: municipalityId ?? '' },
      });
    },
    swallow: true,
  });

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('start.title')} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <VStack gap={4}>
          <Text variant="bodySm">{t('start.explainer')}</Text>

          <Input
            label={t('start.descriptionLabel')}
            placeholder={t('start.descriptionPlaceholder')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <VStack gap={2}>
            <Text variant="bodySm">{t('start.organizeIntro')}</Text>
            <HStack gap={3} className="items-center justify-between">
              <Text className="flex-1">{t('start.organizeToggle')}</Text>
              <Switch value={wantOrganize} onValueChange={setWantOrganize} />
            </HStack>
          </VStack>

          {wantOrganize && (
            <>
              <Input
                label={t('start.phoneLabel')}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              <Input
                label={t('requests.organizer.motivationLabel')}
                value={motivation}
                onChangeText={setMotivation}
                multiline
                numberOfLines={4}
              />
            </>
          )}

          <Button
            onPress={() => {
              if (!municipalityId) return;
              void submit();
            }}
            loading={isPending}
            disabled={!municipalityId || phoneMissing}
            fullWidth
          >
            <Text tone="onAccent">{t('start.submit')}</Text>
          </Button>
        </VStack>
      </ScrollView>
    </Screen>
  );
}
