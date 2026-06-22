import { FlatList, View } from 'react-native';
import { Text } from '../../primitives';
import { PersonCard, AddCard } from '../VillageSections';
import { buildShortName, type PersonData } from '@cultuvilla/shared/models/person';

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
        <AddCard label={addLabel} onPress={onPressAdd} />
        <Text tone="muted" className="flex-1 ml-2">
          {emptyLabel}
        </Text>
      </View>
    );
  }
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={personas}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      renderItem={({ item }) => (
        <PersonCard
          name={buildShortName(item)}
          photoURL={item.photoURL ?? null}
          subtitle={item.nickname ? `@${item.nickname}` : undefined}
          onPress={() => onPressPersona(item.id)}
        />
      )}
      ListFooterComponent={<AddCard label={addLabel} onPress={onPressAdd} />}
    />
  );
}
