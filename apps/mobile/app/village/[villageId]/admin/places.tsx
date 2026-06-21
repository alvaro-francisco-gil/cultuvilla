import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import { PlacesManager } from '../../../../components/feature/proposable/PlacesManager';

// Thin wrapper kept for the legacy /admin/places route. The real surface is
// the shared, capability-driven PlacesManager (also mounted at
// /village/[villageId]/places). Removed in Phase 8.
export default function AdminPlacesScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.places.title')} />
      {villageId ? <PlacesManager villageId={villageId} /> : null}
    </Screen>
  );
}
