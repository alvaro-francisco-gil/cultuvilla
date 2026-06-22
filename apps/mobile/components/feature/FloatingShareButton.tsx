import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from '../primitives/Pressable';
import { useT } from '../../lib/i18n';

// Each platform has its own share glyph: Android/Material uses the three-node
// graph (`share-social`), iOS uses the box-with-up-arrow (`share`). Web follows
// the iOS-style icon. Matching the platform keeps the affordance familiar.
const SHARE_ICON = Platform.OS === 'android' ? 'share-social-outline' : 'share-outline';

/**
 * Circular share affordance that floats over the top-right of a detail-screen
 * hero image. Mirrors {@link FloatingBackButton} on the opposite side so the
 * two together form a balanced "back / share" pair on event and news screens.
 */
export function FloatingShareButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top + 8,
        right: 12,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.45)',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityLabel={t('deeplink.shareViewLabel')}
        className="flex-1 items-center justify-center"
      >
        <Ionicons name={SHARE_ICON} size={22} color="#fff" />
      </Pressable>
    </View>
  );
}
