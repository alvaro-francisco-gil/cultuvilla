import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { PlacesManager } from '../../../components/feature/proposable/PlacesManager';

// Create-only Lugares surface: any member proposes; organizers create directly.
// After submit we return to the pueblo tab, where the new (or pending) item
// shows as a card. Editing/moderation lives in the community ("Editar") screen.
export default function PlacesScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.places.add')} />
      {villageId ? (
        <PlacesManager villageId={villageId} mode="create" onCreated={() => router.back()} />
      ) : null}
    </Screen>
  );
}
