import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable } from '../primitives/Pressable';
import { useT } from '../../lib/i18n';

/**
 * Circular back affordance that floats over the top-left of a detail-screen
 * hero image. Used instead of the main-nav AppHeader so the user can tell they
 * are on a sub-screen and can go back. The dark translucent disc keeps the
 * chevron legible over any photo; the safe-area top inset keeps it clear of the
 * status bar (the hero extends behind it, so the screen sets topInset={false}).
 */
export function FloatingBackButton({ onBack }: { onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const handleBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)')));
  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 12,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.45)',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      <Pressable
        onPress={handleBack}
        accessibilityLabel={t('header.back')}
        className="flex-1 items-center justify-center"
      >
        <Ionicons name="chevron-back" size={24} color="#ffffff" />
      </Pressable>
    </View>
  );
}
