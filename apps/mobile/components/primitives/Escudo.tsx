import { Image, View, StyleSheet } from 'react-native';
import { Text } from './Text';

export interface EscudoProps {
  url: string | null | undefined;
  size?: number;
  /** First letter(s) of the municipality name, shown when `url` is null. */
  fallbackInitial?: string;
}

/**
 * Square heraldic image for a municipality (coat of arms).
 *
 * `null` URL renders an initial-letter placeholder — ~38% of Spanish munis
 * have no escudo on Wikidata, so the empty state is common, not exceptional.
 *
 * Uses `resizeMode="contain"` so heraldic detail isn't cropped at small sizes.
 */
export function Escudo({ url, size = 64, fallbackInitial }: EscudoProps) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: Math.max(4, size * 0.1) },
      ]}
    >
      <Text variant={size >= 96 ? 'h2' : 'body'} tone="muted">
        {(fallbackInitial ?? '·').slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
