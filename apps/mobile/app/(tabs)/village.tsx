import { ActivityIndicator, View } from 'react-native';
import { Screen } from '../../components/primitives';
import { AppHeader } from '../../components/layout/AppHeader';
import { VillageDiscovery } from '../../components/feature/VillageDiscovery';
import { VillageHomeBody } from '../../components/feature/VillageHomeBody';
import { useVillageHome } from '../../lib/useVillageHome';
import { useAuth } from '../../lib/auth/useAuth';

// The middle tab swaps between the active-village home and discovery based on
// the user's activeMunicipalityId. Both the home here and the pushed
// /village/[villageId] detail render the same <VillageHomeBody>.
export default function VillageTabScreen() {
  const { profile, profileChecked } = useAuth();
  const activeMunicipalityId = profile?.activeMunicipalityId ?? null;
  const home = useVillageHome(activeMunicipalityId);

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

  if (!activeMunicipalityId) {
    return (
      <Screen padded={false} topInset={false} bottomInset={false}>
        <AppHeader />
        <VillageDiscovery />
      </Screen>
    );
  }

  return (
    <Screen padded={false} topInset={false} bottomInset={false}>
      <AppHeader centerLabel={home.village?.name} />
      <VillageHomeBody data={home} reload={home.reload} />
    </Screen>
  );
}
