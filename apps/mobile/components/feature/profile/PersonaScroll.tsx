import { FlatList, View } from 'react-native';
import { Text } from '../../primitives';
import { PersonaCard, AddPersonaCard } from './PersonaCard';
import type { PersonData } from '@cultuvilla/shared/models/person';

type Persona = PersonData & { id: string };

export interface PersonaScrollProps {
  personas: Persona[];
  addLabel: string;
  emptyLabel: string;
  onPressPersona: (id: string) => void;
  onPressAdd: () => void;
}

export function PersonaScroll({
  personas,
  addLabel,
  emptyLabel,
  onPressPersona,
  onPressAdd,
}: PersonaScrollProps) {
  if (personas.length === 0) {
    return (
      <View className="flex-row items-center px-4">
        <AddPersonaCard onPress={onPressAdd} label={addLabel} />
        <Text tone="muted" className="flex-1 ml-2">{emptyLabel}</Text>
      </View>
    );
  }
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={personas}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      renderItem={({ item }) => (
        <PersonaCard person={item} onPress={() => onPressPersona(item.id)} />
      )}
      ListFooterComponent={<AddPersonaCard onPress={onPressAdd} label={addLabel} />}
    />
  );
}
