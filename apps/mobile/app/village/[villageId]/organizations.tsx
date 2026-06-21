import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { OrganizationsManager } from '../../../components/feature/proposable/OrganizationsManager';

// Shared Organizations surface: any member proposes a peña/asociación;
// organizers manage. Replaces the read-only member list and the organizer-only
// /admin/organizations screen (kept as a wrapper until Phase 8).
export default function VillageOrganizations() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.organizationsList.title')} />
      {villageId ? <OrganizationsManager villageId={villageId} /> : null}
    </Screen>
  );
}
