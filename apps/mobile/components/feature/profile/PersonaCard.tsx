import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from '../../primitives/Pressable';
import { Text } from '../../primitives/Text';
import { buildShortName } from '@cultuvilla/shared/models/person';
import type { PersonData } from '@cultuvilla/shared/models/person';

export interface PersonaCardProps {
  person: PersonData & { id: string };
  onPress: () => void;
}

export function PersonaCard({ person, onPress }: PersonaCardProps) {
  const short = buildShortName(person);
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <View className="w-28 mr-3 items-center">
        <View className="w-24 h-24 rounded-2xl bg-subtle overflow-hidden items-center justify-center">
          {person.photoURL ? (
            <Image
              source={{ uri: person.photoURL }}
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Ionicons name="person" size={36} color="#94a3b8" />
          )}
        </View>
        {person.nickname ? (
          <Text variant="caption" className="mt-2 font-semibold" numberOfLines={1}>
            @{person.nickname}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {short}
        </Text>
      </View>
    </Pressable>
  );
}

export function AddPersonaCard({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View className="w-28 mr-3 items-center">
        <View className="w-24 h-24 rounded-2xl border-2 border-dashed border-subtle items-center justify-center">
          <Ionicons name="add" size={32} color="#94a3b8" />
        </View>
        <Text variant="caption" tone="muted" className="mt-2 font-semibold" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
