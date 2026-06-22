import { Pressable, Text } from 'react-native';

export type FabProps = {
  onPress: () => void;
  label?: string;
  testID?: string;
};

/**
 * Bottom-right floating action button. Positioning/visual styles live on
 * `style` (never `className`) so the button renders on the RN-Web build.
 */
export function Fab({ onPress, label = '+', testID }: FabProps) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      style={{
        position: 'absolute',
        right: 20,
        bottom: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#1f6feb',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        zIndex: 20,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 28, lineHeight: 30 }}>{label}</Text>
    </Pressable>
  );
}
