import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, VStack, Text, Button, Input } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import {
  getMunicipality,
  updateCommunity,
} from '@cultuvilla/shared/services/municipalityService';

export default function CommunitySettingsScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const [description, setDescription] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!villageId) return;
    getMunicipality(villageId).then((m) => {
      setDescription(m?.community?.description ?? '');
    });
  }, [villageId]);

  async function save() {
    if (!villageId || description === null) return;
    setSaving(true);
    try {
      await updateCommunity(villageId, { description });
      Alert.alert(t('village.admin.community.saved'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.community.title')} />
      <VStack gap={3} className="p-4">
        <Text variant="h3">{t('village.admin.community.description')}</Text>
        <Input
          value={description ?? ''}
          onChangeText={setDescription}
          multiline
          placeholder={t('village.admin.community.description')}
        />
        <Button onPress={save} loading={saving}>{t('common.save')}</Button>
      </VStack>
    </Screen>
  );
}
