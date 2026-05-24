import './../global.css';
import { Redirect, Stack, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { bootstrapFirebase } from '../lib/firebaseInit';
import { AuthProvider } from '../lib/auth/AuthContext';
import { I18nProvider } from '../lib/i18n';
import { useAuth } from '../lib/auth/useAuth';
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
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function AuthGate() {
  const { user, loading, profile, profileChecked } = useAuth();
  const pathname = usePathname();

  if (loading || (user && !profileChecked)) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }
  const needsOnboarding =
    !!user && profileChecked && (!profile || !profile.personId);
  const onOnboardingRoute = pathname?.startsWith('/(onboarding)') || pathname === '/complete-profile';
  if (needsOnboarding && !onOnboardingRoute) {
    return <Redirect href="/(onboarding)/complete-profile" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
