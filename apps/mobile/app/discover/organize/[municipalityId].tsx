import { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, VStack, Text, Input, Button } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth/useAuth';
import { useCallable } from '../../../lib/useCallable';
import { requestOrganizeVillage } from '@cultuvilla/shared/services/organizerRequestService';
import { patchUserProfile } from '@cultuvilla/shared/services/userService';

/**
 * Request to organize an already-active village that has no organizer yet.
 * Activation is decoupled: the village is already started, so this only asks to
 * be granted the organizer (admin) role. Still superadmin-approved. We also
 * capture a contact phone (prefilled from / saved back to the profile).
 */
export default function OrganizeVillageScreen() {
  const { municipalityId } = useLocalSearchParams<{ municipalityId: string }>();
  const { t } = useT();
  const { user, profile } = useAuth();
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

  const phoneMissing = phone.trim().length === 0;

  const { fire: submit, isPending } = useCallable({
    callable: async () => {
      if (user) await patchUserProfile(user.uid, { telephone: phone.trim() });
      await requestOrganizeVillage({
        municipalityId: municipalityId ?? '',
        motivation: motivation.trim() || null,
      });
    },
    onSuccess: () => {
      router.back();
    },
    swallow: true,
  });

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('organize.title')} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <VStack gap={4}>
          <Text tone="muted" variant="bodySm">
            {t('organize.explainer')}
          </Text>
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
          <Button
            onPress={() => {
              if (!municipalityId) return;
              void submit();
            }}
            loading={isPending}
            disabled={!municipalityId || phoneMissing}
            fullWidth
          >
            <Text tone="onAccent">{t('organize.submit')}</Text>
          </Button>
        </VStack>
      </ScrollView>
    </Screen>
  );
}
