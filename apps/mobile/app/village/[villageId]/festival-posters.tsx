import { Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { FestivalPostersManager } from '../../../components/feature/proposable/FestivalPostersManager';

export default function FestivalPostersScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title={t('village.festivalPosters.add')} />
      {villageId ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FestivalPostersManager villageId={villageId} onCreated={() => router.back()} />
        </KeyboardAvoidingView>
      ) : null}
    </Screen>
  );
}
