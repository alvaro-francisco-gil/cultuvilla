import { Image, View, StyleSheet } from 'react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface AvatarProps {
  uri?: string | null;
  size?: number;
  initials?: string;
  onPress?: () => void;
}

export function Avatar({ uri, size = 96, initials, onPress }: AvatarProps) {
  const radius = size / 2;
  const content = uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: radius }}
      accessibilityIgnoresInvertColors
    />
  ) : (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      <Text variant="h2" tone="muted">{initials ?? '+'}</Text>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
