import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, VStack, Text, Input, Button } from '../../../components/primitives';
import { useT } from '../../../lib/i18n';
import { requestOrganizeVillage } from '@cultuvilla/shared/services/organizerRequestService';

export default function RequestOrganizerScreen() {
  const { municipalityId } = useLocalSearchParams<{ municipalityId: string }>();
  const { t } = useT();
  const [motivation, setMotivation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!municipalityId) return;
    setError(null);
    setLoading(true);
    try {
      await requestOrganizeVillage({
        municipalityId,
        motivation: motivation.trim() || null,
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
        <Text variant="h2">{t('requests.organizer.title')}</Text>
        <Input
          label={t('requests.organizer.motivationLabel')}
          value={motivation}
          onChangeText={setMotivation}
          multiline
          numberOfLines={4}
        />
        {error && <Text tone="danger">{error}</Text>}
        <Button onPress={onSubmit} loading={loading} fullWidth>
          <Text tone="onAccent">{t('requests.organizer.submit')}</Text>
        </Button>
      </VStack>
    </Screen>
  );
}
