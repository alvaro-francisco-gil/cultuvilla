import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, VStack, Text, Input, Button } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { useCallable } from '../../../lib/useCallable';
import { requestOrganizeVillage } from '@cultuvilla/shared/services/organizerRequestService';

export default function RequestOrganizerScreen() {
  const { municipalityId } = useLocalSearchParams<{ municipalityId: string }>();
  const { t } = useT();
  const [motivation, setMotivation] = useState('');

  const { fire: submit, isPending } = useCallable({
    callable: () =>
      requestOrganizeVillage({
        municipalityId: municipalityId ?? '',
        motivation: motivation.trim() || null,
      }),
    onSuccess: () => {
      router.back();
    },
    swallow: true,
  });

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('requests.organizer.title')} />
      <VStack gap={4} className="p-4">
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
          fullWidth
        >
          <Text tone="onAccent">{t('requests.organizer.submit')}</Text>
        </Button>
      </VStack>
    </Screen>
  );
}
