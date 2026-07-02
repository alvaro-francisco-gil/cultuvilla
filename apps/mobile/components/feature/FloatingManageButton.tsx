import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from '../primitives/Pressable';

/**
 * Circular management affordance that floats over a detail-screen hero image,
 * sitting immediately to the left of {@link FloatingEditButton}. Shown only to
 * users who can manage the entity (e.g. event organizers). Where the edit
 * button opens the full creation stepper to change the event's content, this
 * button opens the organizer console (attendee roster + cancel/complete). The
 * right offset (108) clears the 40px-wide edit button at right:60 plus an 8px
 * gap.
 */
export function FloatingManageButton({
  onPress,
  accessibilityLabel,
}: {
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top + 8,
        right: 108,
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
        accessibilityLabel={accessibilityLabel}
        className="flex-1 items-center justify-center"
      >
        <Ionicons name="people-outline" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}
