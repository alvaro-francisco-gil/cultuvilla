import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { PlacesManager } from '../../../components/feature/proposable/PlacesManager';

// Lugares create surface: any member proposes; organizers create directly.
// After submit we return to the pueblo tab, where the new (or pending) item
// shows as a card. Editing lives on the place's edit screen.
export default function PlacesScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.places.add')} />
      {villageId ? (
        <PlacesManager villageId={villageId} onCreated={() => router.back()} />
      ) : null}
    </Screen>
  );
}
