import { Redirect, useLocalSearchParams } from 'expo-router';

// Invite share links are /village/<id>/join (see deepLinkService). On web,
// expo-router routes by matching the URL to a file, so this route must exist —
// otherwise the URL falls to the unmatched screen and the native-oriented
// Linking listener in useDeepLinkRouter can't rescue it. Redirect into the
// village home carrying the join intent, which renders the "invited" banner.
export default function VillageJoinRedirect() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  if (!villageId) return <Redirect href="/(tabs)" />;
  return (
    <Redirect href={{ pathname: '/village/[villageId]', params: { villageId, intent: 'join' } }} />
  );
}
