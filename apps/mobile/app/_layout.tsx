import './../global.css';
import { Redirect, Stack, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { bootstrapFirebase } from '../lib/firebaseInit';
import { AuthProvider } from '../lib/auth/AuthContext';
import { CallableErrorProvider } from '../lib/callableError';
import { I18nProvider } from '../lib/i18n';
import { useAuth } from '../lib/auth/useAuth';
import { resolveAuthRoute } from '../lib/auth/authRoute';
import { useDeepLinkRouter } from '../lib/deeplink/useDeepLinkRouter';
import { ActivityIndicator, View } from 'react-native';

bootstrapFirebase();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Fraunces_700Bold });
  if (!fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <CallableErrorProvider>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </CallableErrorProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function AuthGate() {
  const { user, loading, profile, profileChecked } = useAuth();
  const segments = useSegments();
  useDeepLinkRouter();

  if (loading || (user && !profileChecked)) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }
  const target = resolveAuthRoute({
    user: !!user,
    profileChecked,
    hasPersonId: !!profile?.personId,
    topSegment: segments[0],
  });
  if (target) {
    return <Redirect href={target} />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
