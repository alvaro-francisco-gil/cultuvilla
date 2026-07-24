import { Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { PlacesManager } from '../../../components/feature/proposable/PlacesManager';

export default function PlacesScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title={t('village.admin.places.add')} />
      {villageId ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <PlacesManager villageId={villageId} onCreated={() => router.back()} />
        </KeyboardAvoidingView>
      ) : null}
    </Screen>
  );
}
