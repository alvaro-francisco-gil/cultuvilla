import { useEffect } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { VillageHomeBody } from '../../../components/feature/VillageHomeBody';
import { useVillageHome } from '../../../lib/useVillageHome';
import { useAuth } from '../../../lib/auth/useAuth';
import { useGuestActiveVillage } from '../../../lib/village/GuestActiveVillageContext';

// Root of the village-detail subtree (barrios, places, festival posters,
// members…), pushed and back-navigable when reached in-app from discovery, a
// profile, the inbox or a news mention. Reuses the same <VillageHomeBody> as
// the pueblo tab; the only difference is the header (ScreenHeader + back
// button).
//
// It is ALSO the target of an external share link
// (https://<host>/village/<id>). Arriving that way is a COLD entry: there is
// no back-stack and no tab shell, so the bare ScreenHeader back button would
// be a dead end. We detect that with `!router.canGoBack()` and send the
// visitor into the tab shell (bottom tabs + header) showing this village
// instead — so a share link always lands you inside the app, regardless of
// auth state. For a guest we mark it as their active village (the shell reads
// it via useActiveVillageId); for a signed-in member we pass it as a transient
// `villageId` param so the shell can render it WITHOUT overwriting their home.
export default function VillageHome() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { user } = useAuth();
  const { activate } = useGuestActiveVillage();
  const id = (villageId as string) ?? null;
  const coldEntry = !router.canGoBack();

  useEffect(() => {
    if (coldEntry && !user && id) activate(id);
  }, [coldEntry, user, id, activate]);

  // Skip the fetch when we're redirecting away this render.
  const home = useVillageHome(coldEntry ? null : id);

  if (coldEntry && id) {
    return <Redirect href={`/(tabs)/village?villageId=${id}`} />;
  }

  return (
    <Screen padded={false} topInset={false}>
      <ScreenHeader title={home.village?.name} />
      <VillageHomeBody data={home} reload={home.reload} />
    </Screen>
  );
}
