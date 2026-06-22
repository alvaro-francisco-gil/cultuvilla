import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import { CommunitySettingsEditor } from '../../../../components/feature/CommunitySettingsEditor';

// Thin wrapper kept for the legacy /admin/community route. The shared route
// (/village/[villageId]/community) gates the same editor to organizers.
// Removed in Phase 8.
export default function AdminCommunityScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.community.title')} />
      {villageId ? <CommunitySettingsEditor villageId={villageId} /> : null}
    </Screen>
  );
}
