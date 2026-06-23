import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { OrganizationsManager } from '../../../components/feature/proposable/OrganizationsManager';

// Create-only Agrupaciones surface: any member proposes a peña/asociación/otros;
// organizers create (auto-approved). After submit we return to the pueblo tab.
// Moderation lives in the community ("Editar") screen.
export default function VillageOrganizations() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.organizations.add')} />
      {villageId ? (
        <OrganizationsManager villageId={villageId} mode="create" onCreated={() => router.back()} />
      ) : null}
    </Screen>
  );
}
