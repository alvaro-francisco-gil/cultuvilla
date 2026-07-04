import './../global.css';
import { Redirect, Stack, useSegments, router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { bootstrapFirebase } from '../lib/firebaseInit';
import { AuthProvider } from '../lib/auth/AuthContext';
import { CallableErrorProvider } from '../lib/callableError';
import { I18nProvider } from '../lib/i18n';
import { useAuth } from '../lib/auth/useAuth';
import { resolveAuthRoute, resolveIntentResume } from '../lib/auth/authRoute';
import { RegisterGateProvider, useRegisterGate } from '../lib/auth/RegisterGateContext';
import { useDeepLinkRouter } from '../lib/deeplink/useDeepLinkRouter';
import { CropperHost } from '../lib/imageCrop';
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
            <RegisterGateProvider>
              <AuthGate />
              {/* Web-only image-crop overlay (no-op on native, which uses its
                  own native cropper). Rendered above the app so it can cover
                  any screen when pickImageAsBlob({ square }) opens it. */}
              <CropperHost />
            </RegisterGateProvider>
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
  const { pendingIntent, clearPending } = useRegisterGate();

  const intentTarget = resolveIntentResume({
    user: !!user,
    profileChecked,
    hasPersonId: !!profile?.personId,
    pendingIntent,
  });

  useEffect(() => {
    if (intentTarget) {
      clearPending();
      // Lay down the tabs home as the base BEFORE pushing the resumed target,
      // so the target screen has somewhere to pop back to. Replacing straight
      // to a deep screen (e.g. /event/new) leaves an empty stack and the back
      // button errors with "GO_BACK was not handled by any navigator".
      router.replace('/(tabs)');
      router.push(intentTarget as Href);
    }
  }, [intentTarget, clearPending]);

  if (loading || (user && !profileChecked)) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }

  // While resuming, suppress the default /(tabs) redirect so the replace wins.
  if (intentTarget) {
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
