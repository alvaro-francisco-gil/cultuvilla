import { useEffect } from 'react';
import { Stack, Redirect, router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../lib/auth/useAuth';
import { useIsAppAdmin } from '../../lib/auth/useIsAppAdmin';

export default function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  const { isAppAdmin, loading: adminLoading } = useIsAppAdmin();

  useEffect(() => {
    if (authLoading || adminLoading) return;
    if (!user || !isAppAdmin) router.replace('/');
  }, [user, authLoading, isAppAdmin, adminLoading]);

  if (authLoading || adminLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (!isAppAdmin) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
