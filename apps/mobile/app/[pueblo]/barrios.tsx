import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { BarriosManager } from '../../../components/feature/proposable/BarriosManager';

// Barrios create surface: any member proposes; organizers create directly.
// After submit we return to the pueblo tab. Editing lives on the barrio's edit screen.
export default function BarriosScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.barrios.add')} />
      {villageId ? (
        <BarriosManager villageId={villageId} onCreated={() => router.back()} />
      ) : null}
    </Screen>
  );
}
