import { useEffect } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { VillageHomeBody } from '../../../components/feature/VillageHomeBody';
import { useVillageHome } from '../../../lib/useVillageHome';
import { useAuth } from '../../../lib/auth/useAuth';
import { useGuestActiveVillage } from '../../../lib/village/GuestActiveVillageContext';

// Pushed, back-navigable village home reached from discovery. Reuses the same
// <VillageHomeBody> as the pueblo tab; the only difference is the header
// (ScreenHeader with a back button).
//
// A logged-out visitor arriving here via a share link has no back-stack and no
// tab shell around them — a chrome-less dead end. Instead we make the shared
// village their active one and send them into the tab shell (bottom tabs +
// header), so they land exactly where a signed-in member would.
export default function VillageHome() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { user } = useAuth();
  const { activate } = useGuestActiveVillage();
  const id = (villageId as string) ?? null;
  const isGuest = !user;

  useEffect(() => {
    if (isGuest && id) activate(id);
  }, [isGuest, id, activate]);

  // Skip the fetch for guests — they redirect away this render.
  const home = useVillageHome(isGuest ? null : id);

  if (isGuest) {
    return <Redirect href="/(tabs)/village" />;
  }

  return (
    <Screen padded={false} topInset={false}>
      <ScreenHeader title={home.village?.name} />
      <VillageHomeBody data={home} reload={home.reload} />
    </Screen>
  );
}
