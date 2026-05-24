import { useEffect, useState } from 'react';
import { Stack, Redirect, useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../../../lib/auth/useAuth';
import { useIsAppAdmin } from '../../../../lib/auth/useIsAppAdmin';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';

export default function VillageAdminLayout() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { isAppAdmin, loading: appAdminLoading } = useIsAppAdmin();
  const [villageAdmin, setVillageAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || !villageId) {
      setVillageAdmin(null);
      return;
    }
    let cancelled = false;
    isVillageAdmin(villageId, user.uid).then((ok) => {
      if (!cancelled) setVillageAdmin(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [user, villageId]);

  const loading = authLoading || appAdminLoading || villageAdmin === null;
  const canManage = isAppAdmin || villageAdmin === true;

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (!canManage) router.replace(`/village/${villageId}`);
  }, [loading, user, canManage, villageId]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (!canManage) return <Redirect href={`/village/${villageId}`} />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
