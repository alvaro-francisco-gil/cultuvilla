import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { PlacesManager } from '../../../components/feature/proposable/PlacesManager';

// Shared Lugares surface: any member can propose; organizers manage. Replaces
// the organizer-only /admin/places screen (kept as a wrapper until Phase 8).
export default function PlacesScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.places.title')} />
      {villageId ? <PlacesManager villageId={villageId} /> : null}
    </Screen>
  );
}
