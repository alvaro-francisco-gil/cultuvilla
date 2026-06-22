import { useState } from 'react';
import { ScrollView, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, VStack, HStack, Text, Input, Button } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { useCallable } from '../../../lib/useCallable';
import { startVillage } from '@cultuvilla/shared/services/municipalityService';
import { requestOrganizeVillage } from '@cultuvilla/shared/services/organizerRequestService';

/**
 * "Start this village" — self-service activation of a dormant municipality.
 * Activating it makes the village joinable and adds the starter as its first
 * member; it does NOT make them the organizer. The optional toggle files an
 * organizer request in the same flow (still superadmin-approved).
 */
export default function StartVillageScreen() {
  const { municipalityId } = useLocalSearchParams<{ municipalityId: string }>();
  const { t } = useT();
  const [description, setDescription] = useState('');
  const [wantOrganize, setWantOrganize] = useState(false);
  const [motivation, setMotivation] = useState('');

  const { fire: submit, isPending } = useCallable({
    callable: async () => {
      const id = municipalityId ?? '';
      await startVillage({ municipalityId: id, description: description.trim() });
      if (wantOrganize) {
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
          <Text tone="muted" variant="bodySm">
            {t('start.explainer')}
          </Text>

          <Input
            label={t('start.descriptionLabel')}
            placeholder={t('start.descriptionPlaceholder')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <HStack gap={3} className="items-center justify-between">
            <VStack gap={1} className="flex-1">
              <Text>{t('start.organizeToggle')}</Text>
              <Text tone="muted" variant="bodySm">
                {t('start.organizeHint')}
              </Text>
            </VStack>
            <Switch value={wantOrganize} onValueChange={setWantOrganize} />
          </HStack>

          {wantOrganize && (
            <Input
              label={t('requests.organizer.motivationLabel')}
              value={motivation}
              onChangeText={setMotivation}
              multiline
              numberOfLines={4}
            />
          )}

          <Button
            onPress={() => {
              if (!municipalityId) return;
              void submit();
            }}
            loading={isPending}
            disabled={!municipalityId}
            fullWidth
          >
            <Text tone="onAccent">{t('start.submit')}</Text>
          </Button>
        </VStack>
      </ScrollView>
    </Screen>
  );
}
