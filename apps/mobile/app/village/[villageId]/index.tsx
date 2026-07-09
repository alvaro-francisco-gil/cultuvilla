import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { VillageHomeBody } from '../../../components/feature/VillageHomeBody';
import { useVillageHome } from '../../../lib/useVillageHome';

// Pushed, back-navigable village home reached from discovery. Reuses the same
// <VillageHomeBody> as the pueblo tab; the only difference is the header
// (ScreenHeader with a back button).
export default function VillageHome() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const home = useVillageHome((villageId as string) ?? null);

  return (
    <Screen padded={false} topInset={false}>
      <ScreenHeader title={home.village?.name} />
      <VillageHomeBody data={home} reload={home.reload} />
    </Screen>
  );
}
