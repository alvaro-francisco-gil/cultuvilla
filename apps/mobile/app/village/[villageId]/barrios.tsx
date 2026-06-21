import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { BarriosManager } from '../../../components/feature/proposable/BarriosManager';

// Shared Barrios surface: any member can propose; organizers manage. Replaces
// the organizer-only /admin/barrios screen (kept as a wrapper until Phase 8).
export default function BarriosScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.barrios.title')} />
      {villageId ? <BarriosManager villageId={villageId} /> : null}
    </Screen>
  );
}
