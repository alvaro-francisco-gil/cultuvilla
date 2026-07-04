import { useState } from 'react';
import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, VStack, Text, Input, Button } from '../../../components/primitives';
import { PhoneField } from '../../../components/feature/PhoneField';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth/useAuth';
import { useCallable } from '../../../lib/useCallable';
import { useOrganizerPhone } from '../../../lib/useOrganizerPhone';
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
  const organizerPhone = useOrganizerPhone(profile?.telephone);
  const [motivation, setMotivation] = useState('');

  const { fire: submit, isPending } = useCallable({
    callable: async () => {
      if (user) await patchUserProfile(user.uid, { telephone: organizerPhone.e164 });
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
          <PhoneField {...organizerPhone.fieldProps} />
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
              if (!organizerPhone.validateForSubmit()) return;
              void submit();
            }}
            loading={isPending}
            disabled={!municipalityId}
            fullWidth
            testID="organize-submit"
          >
            <Text tone="onAccent">{t('organize.submit')}</Text>
          </Button>
        </VStack>
      </ScrollView>
    </Screen>
  );
}
