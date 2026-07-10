import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { FestivalPostersManager } from '../../../components/feature/proposable/FestivalPostersManager';

// Carteles de fiestas create surface: any member proposes; organizers create
// directly. After submit we return to the pueblo tab. Editing lives on the
// poster's edit screen.
export default function FestivalPostersScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.festivalPosters.add')} />
      {villageId ? (
        <FestivalPostersManager villageId={villageId} onCreated={() => router.back()} />
      ) : null}
    </Screen>
  );
}
