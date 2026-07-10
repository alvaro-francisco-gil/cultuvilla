import { useEffect, useState } from 'react';
import { useLocalSearchParams, Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { MembersList } from '../../../components/feature/MembersList';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { isVillageMember } from '@cultuvilla/shared/services/villageMemberService';
import { useT } from '../../../lib/i18n';

// Villagers roster ("Personas") — reached by tapping the personas stat on the
// village home. Members-only: non-members who deep-link here are bounced back to
// the village. Admins keep the promote/demote row action via MembersList's
// `canManage`; non-admin members see the same table read-only.
export default function VillageMembersScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { canManage, uid, loading } = useEntityCapabilities(villageId);
  const { t } = useT();
  const [isMember, setIsMember] = useState<boolean | null>(null);

  useEffect(() => {
    if (!villageId || !uid) {
      setIsMember(false);
      return;
    }
    let cancelled = false;
    setIsMember(null);
    isVillageMember(villageId, uid).then((ok) => {
      if (!cancelled) setIsMember(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [villageId, uid]);

  if (!villageId) return null;

  if (loading || isMember === null) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader title={t('village.villagers.title')} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  // App/village admins can always view; everyone else must be a member.
  if (!isMember && !canManage) return <Redirect href={`/village/${villageId}`} />;

  return (
    <Screen padded={false} topInset={false}>
      <ScreenHeader title={t('village.villagers.title')} />
      <MembersList villageId={villageId} canManage={canManage} currentUserId={uid} />
    </Screen>
  );
}
