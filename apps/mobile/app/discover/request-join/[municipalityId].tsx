import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, VStack, Text, Input, Button } from '../../../components/primitives';
import { useT } from '../../../lib/i18n';
import { requestJoinVillage } from '@cultuvilla/shared/services/joinRequestService';

export default function RequestJoinScreen() {
  const { municipalityId } = useLocalSearchParams<{ municipalityId: string }>();
  const { t } = useT();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!municipalityId) return;
    setError(null);
    setLoading(true);
    try {
      await requestJoinVillage({
        municipalityId,
        message: message.trim() || null,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <VStack gap={4}>
        <Text variant="h2">{t('requests.join.title')}</Text>
        <Input
          label={t('requests.join.messageLabel')}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={4}
        />
        {error && <Text tone="danger">{error}</Text>}
        <Button onPress={onSubmit} loading={loading} fullWidth>
          <Text tone="onAccent">{t('requests.join.submit')}</Text>
        </Button>
      </VStack>
    </Screen>
  );
}
