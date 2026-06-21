import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import { BarriosManager } from '../../../../components/feature/proposable/BarriosManager';

// Thin wrapper kept for the legacy /admin/barrios route. The real surface is
// the shared, capability-driven BarriosManager (also mounted at
// /village/[villageId]/barrios). Removed in Phase 8.
export default function AdminBarriosScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.barrios.title')} />
      {villageId ? <BarriosManager villageId={villageId} /> : null}
    </Screen>
  );
}
