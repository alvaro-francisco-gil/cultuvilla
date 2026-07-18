import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../components/primitives';
import { AppHeader } from '../../components/layout/AppHeader';
import { VillageDiscovery } from '../../components/feature/VillageDiscovery';
import { VillageHomeBody } from '../../components/feature/VillageHomeBody';
import { useVillageHome } from '../../lib/useVillageHome';
import { useAuth } from '../../lib/auth/useAuth';
import { useActiveVillageId } from '../../lib/village/useActiveVillageId';
import { useT } from '../../lib/i18n';

// The middle tab swaps between a village home and discovery. It normally shows
// the active village — a signed-in user's activeMunicipalityId, or the village
// a logged-out visitor opened via a share link. A `villageId` query param
// overrides that transiently: a share link resolved cold (see
// /village/[villageId]) redirects here with the param so the shell renders the
// shared village WITHOUT overwriting the viewer's home village. Both the home
// here and the pushed /village/[villageId] detail render the same
// <VillageHomeBody>.
export default function VillageTabScreen() {
  const { profileChecked } = useAuth();
  const { t } = useT();
  const { villageId } = useLocalSearchParams<{ villageId?: string }>();
  const activeMunicipalityId = useActiveVillageId();
  const displayVillageId = (villageId as string) || activeMunicipalityId;
  const home = useVillageHome(displayVillageId);

  // AuthGate already waits for `profileChecked`, but guard once more for safety.
  if (!profileChecked) {
    return (
      <Screen padded={false} topInset={false} bottomInset={false}>
        <AppHeader />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (!displayVillageId) {
    return (
      <Screen padded={false} topInset={false} bottomInset={false}>
        <AppHeader />
        <VillageDiscovery />
      </Screen>
    );
  }

  return (
    <Screen padded={false} topInset={false} bottomInset={false}>
      <AppHeader centerLabel={t('tabs.village')} />
      <VillageHomeBody data={home} reload={home.reload} />
    </Screen>
  );
}
