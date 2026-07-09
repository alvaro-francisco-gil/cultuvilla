import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from '../primitives/Pressable';
import { useT } from '../../lib/i18n';

/**
 * Circular edit affordance that floats over a detail-screen hero image, sitting
 * immediately to the left of {@link FloatingShareButton}. Shown only to users
 * who can manage the entity (e.g. event organizers), so the in-body edit button
 * stays out of the content flow. The right offset (60) clears the 40px-wide
 * share button at right:12 plus an 8px gap.
 *
 * `accessibilityLabel` is optional — callers with a more specific label (e.g.
 * "Editar evento") pass one; callers that just want the generic affordance
 * (org/place/barrio detail screens) omit it and get `common.edit`.
 */
export function FloatingEditButton({
  onPress,
  accessibilityLabel,
}: {
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top + 8,
        right: 60,
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
        accessibilityLabel={accessibilityLabel ?? t('common.edit')}
        className="flex-1 items-center justify-center"
      >
        <Ionicons name="create-outline" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}
