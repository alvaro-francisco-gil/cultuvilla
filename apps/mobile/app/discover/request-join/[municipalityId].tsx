import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, VStack, Text, Input, Button } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { useCallable } from '../../../lib/useCallable';
import { requestJoinVillage } from '@cultuvilla/shared/services/joinRequestService';

export default function RequestJoinScreen() {
  const { municipalityId } = useLocalSearchParams<{ municipalityId: string }>();
  const { t } = useT();
  const [message, setMessage] = useState('');

  const { fire: submit, isPending } = useCallable({
    callable: () =>
      requestJoinVillage({
        municipalityId: municipalityId ?? '',
        message: message.trim() || null,
      }),
    onSuccess: () => {
      router.back();
    },
    swallow: true,
  });

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('requests.join.title')} />
      <VStack gap={4} className="p-4">
        <Input
          label={t('requests.join.messageLabel')}
          value={message}
          onChangeText={setMessage}
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
          <Text tone="onAccent">{t('requests.join.submit')}</Text>
        </Button>
      </VStack>
    </Screen>
  );
}
