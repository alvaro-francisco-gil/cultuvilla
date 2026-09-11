import { useVillageRoute, withVillageRoute } from '../../lib/navigation/VillageRouteGate';
import { Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useT } from '../../lib/i18n';
import { FestivalPostersManager } from '../../components/feature/proposable/FestivalPostersManager';

function FestivalPostersScreen() {
  const { municipalityId: villageId, slug: villageSlug } = useVillageRoute();
  const { t } = useT();
  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title={t('village.festivalPosters.add')} />
      {villageId ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FestivalPostersManager villageId={villageId} onCreated={() => router.back()} />
        </KeyboardAvoidingView>
      ) : null}
    </Screen>
  );
}

export default withVillageRoute(FestivalPostersScreen);
