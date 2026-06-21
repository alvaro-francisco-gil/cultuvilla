import { useState } from 'react';
import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, VStack, Text, Input, Button } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { useCallable } from '../../../lib/useCallable';
import { requestOrganizeVillage } from '@cultuvilla/shared/services/organizerRequestService';

/**
 * Request to organize an already-active village that has no organizer yet.
 * Activation is decoupled: the village is already started, so this only asks to
 * be granted the organizer (admin) role. Still superadmin-approved.
 */
export default function OrganizeVillageScreen() {
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
      <ScreenHeader title={t('organize.title')} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <VStack gap={4}>
          <Text tone="muted" variant="bodySm">
            {t('organize.explainer')}
          </Text>
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
            disabled={!municipalityId}
            fullWidth
          >
            <Text tone="onAccent">{t('organize.submit')}</Text>
          </Button>
        </VStack>
      </ScrollView>
    </Screen>
  );
}
