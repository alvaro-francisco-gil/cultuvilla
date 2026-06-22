import { Pressable, Text, View } from 'react-native';

export type FabProps = {
  onPress: () => void;
  /** Text shown inside the pill (e.g. "Crear evento" / "Crear noticia"). */
  label: string;
  testID?: string;
};

/**
 * Orange, horizontally-centered floating action button (ordago-style "create"
 * pill). Pinned just above the bottom; the outer wrapper is `box-none` so it
 * never blocks taps on the feed behind it. All visual styles live on `style`
 * (never `className`) so the button renders on the RN-Web build.
 */
export function Fab({ onPress, label, testID }: FabProps) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 24,
        alignItems: 'center',
        zIndex: 20,
      }}
    >
      <Pressable
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
          paddingHorizontal: 22,
          borderRadius: 999,
          // accent (terracotta) — matches the AppHeader bg-accent token
          backgroundColor: '#bb5d3a',
          elevation: 6,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <Text style={{ color: '#f9f0e8', fontSize: 22, lineHeight: 24, marginRight: 8 }}>+</Text>
        <Text style={{ color: '#f9f0e8', fontSize: 16, fontWeight: '700' }}>{label}</Text>
      </Pressable>
    </View>
  );
}
