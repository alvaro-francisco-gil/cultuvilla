import { FlatList, View } from 'react-native';
import { Text } from '../../primitives';
import { EntityCard, AddCard } from '../VillageSections';

export interface VillageRow {
  municipalityId: string;
  name: string;
  escudoThumbUrl: string | null;
  role: 'admin' | 'user';
}

export interface VillagesScrollProps {
  villages: VillageRow[];
  activeId: string | null;
  joinLabel: string;
  emptyLabel: string;
  badges: { active: string; admin: string; member: string };
  onPressVillage: (municipalityId: string) => void;
  onPressJoin: () => void;
}

export function VillagesScroll({
  villages,
  activeId,
  joinLabel,
  emptyLabel,
  badges,
  onPressVillage,
  onPressJoin,
}: VillagesScrollProps) {
  function secondaryFor(row: VillageRow): string {
    if (row.municipalityId === activeId) return badges.active;
    return row.role === 'admin' ? badges.admin : badges.member;
  }

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
          sub={secondaryFor(item)}
          icon="map-outline"
          imageUri={item.escudoThumbUrl}
          accent={item.municipalityId === activeId}
          onPress={() => onPressVillage(item.municipalityId)}
        />
      )}
      ListFooterComponent={<AddCard label={joinLabel} onPress={onPressJoin} />}
    />
  );
}
