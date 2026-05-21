import './../global.css';
import { Redirect, Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { bootstrapFirebase } from '../lib/firebaseInit';
import { AuthProvider } from '../lib/auth/AuthContext';
import { I18nProvider } from '../lib/i18n';
import { useAuth } from '../lib/auth/useAuth';
import { ActivityIndicator, View } from 'react-native';

bootstrapFirebase();

export default function RootLayout() {
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
  if (loading || (user && !profileChecked)) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }
  if (user && profileChecked && !profile) {
    return <Redirect href="/(onboarding)/complete-profile" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
