import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { FestivalPostersManager } from '../../../components/feature/proposable/FestivalPostersManager';

// Create-only Carteles de fiestas surface: any member proposes; organizers
// create directly. After submit we return to the pueblo tab. Moderation lives
// in the community ("Editar") screen.
export default function FestivalPostersScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.festivalPosters.add')} />
      {villageId ? (
        <FestivalPostersManager villageId={villageId} mode="create" onCreated={() => router.back()} />
      ) : null}
    </Screen>
  );
}
