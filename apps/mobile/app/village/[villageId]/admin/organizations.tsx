import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import { OrganizationsManager } from '../../../../components/feature/proposable/OrganizationsManager';

// Thin wrapper kept for the legacy /admin/organizations route. The real surface
// is the shared, capability-driven OrganizationsManager (also mounted at
// /village/[villageId]/organizations). Removed in Phase 8.
export default function AdminOrganizationsScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.organizations.title')} />
      {villageId ? <OrganizationsManager villageId={villageId} /> : null}
    </Screen>
  );
}
