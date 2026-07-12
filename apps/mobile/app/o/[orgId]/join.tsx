import { Redirect, useLocalSearchParams } from 'expo-router';

// Org invite share links are /o/<id>/join (see deepLinkService). Same reason as
// village/[villageId]/join: web routing needs a real route file, so redirect
// into the org detail carrying the join intent (renders the "invited" banner).
export default function OrgJoinRedirect() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  if (!orgId) return <Redirect href="/(tabs)" />;
  return <Redirect href={{ pathname: '/o/[orgId]', params: { orgId, intent: 'join' } }} />;
}
