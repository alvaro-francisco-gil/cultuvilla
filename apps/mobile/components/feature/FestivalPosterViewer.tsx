import { Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text } from '../primitives';
import { useT } from '../../lib/i18n';

/**
 * Full-screen poster viewer as an absolute-positioned overlay — not RN
 * `Modal`, which behaves badly on the Firebase-hosting web build.
 */
export function FestivalPosterViewer({
  imageUri,
  caption,
  onClose,
}: {
  imageUri: string;
  caption?: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.92)',
        zIndex: 50,
      }}
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel={t('village.festivalPosters.viewer.close')}
        style={{ position: 'absolute', top: insets.top + 8, right: 16, zIndex: 51, padding: 8 }}
      >
        <Ionicons name="close" size={28} color="#ffffff" />
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Image source={{ uri: imageUri }} style={{ width: '100%', height: '85%' }} resizeMode="contain" />
        {caption ? (
          <Text variant="body" style={{ color: '#ffffff', marginTop: 12 }} numberOfLines={2}>
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
