import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import { CensoSchemaEditor } from '../../../../components/feature/CensoSchemaEditor';

// Thin wrapper kept for the legacy /admin/censo route. The shared censo screen
// (/village/[villageId]/censo) shows this same editor to organizers and the
// answer form to villagers. Removed in Phase 8.
export default function AdminCensoScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.hub.censo')} />
      {villageId ? <CensoSchemaEditor villageId={villageId} /> : null}
    </Screen>
  );
}
