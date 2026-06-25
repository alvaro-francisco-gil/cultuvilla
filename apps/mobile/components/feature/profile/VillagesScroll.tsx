import { FlatList, View } from 'react-native';
import { Text } from '../../primitives';
import { EntityCard, AddCard } from '../VillageSections';

export interface VillageRow {
  municipalityId: string;
  name: string;
  comunidadAutonoma: string;
  escudoUrl: string | null;
  /** True when the village admin uploaded their own escudo — keep it full-bleed. */
  manualEscudo: boolean;
  role: 'admin' | 'user';
}

export interface VillagesScrollProps {
  villages: VillageRow[];
  activeId: string | null;
  joinLabel: string;
  emptyLabel: string;
  onPressVillage: (municipalityId: string) => void;
  onPressJoin: () => void;
}

export function VillagesScroll({
  villages,
  activeId,
  joinLabel,
  emptyLabel,
  onPressVillage,
  onPressJoin,
}: VillagesScrollProps) {
  if (villages.length === 0) {
    return (
      <View className="flex-row items-center px-4">
        <AddCard label={joinLabel} onPress={onPressJoin} />
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
      data={villages}
      keyExtractor={(v) => v.municipalityId}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      renderItem={({ item }) => (
        <EntityCard
          label={item.name}
          sub={item.comunidadAutonoma}
          icon="map-outline"
          imageUri={item.escudoUrl}
          crest={!item.manualEscudo}
          accent={item.municipalityId === activeId}
          onPress={() => onPressVillage(item.municipalityId)}
        />
      )}
      ListFooterComponent={<AddCard label={joinLabel} onPress={onPressJoin} />}
    />
  );
}
