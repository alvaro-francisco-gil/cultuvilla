import { Image, View, StyleSheet } from 'react-native';
import { Text } from './Text';

export interface EscudoProps {
  url: string | null | undefined;
  size?: number;
  /** First letter(s) of the municipality name, shown when `url` is null. */
  fallbackInitial?: string;
  /**
   * Render as a rounded square that fully covers its box (`resizeMode="cover"`)
   * instead of letterboxing inside it. Use for square-cropped manual escudos;
   * leave off for Wikidata heraldic shields, which `contain` so detail isn't cut.
   */
  fill?: boolean;
}

/**
 * Square heraldic image for a municipality (coat of arms).
 *
 * `null` URL renders an initial-letter placeholder — ~38% of Spanish munis
 * have no escudo on Wikidata, so the empty state is common, not exceptional.
 *
 * Defaults to `resizeMode="contain"` so heraldic detail isn't cropped at small
 * sizes; pass `fill` for square images that should fill a rounded square.
 */
export function Escudo({ url, size = 64, fallbackInitial, fill = false }: EscudoProps) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{
          width: size,
          height: size,
          borderRadius: fill ? Math.max(4, size * 0.18) : 0,
        }}
        resizeMode={fill ? 'cover' : 'contain'}
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
