import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, VStack } from '../../primitives';

export interface OrgListItem {
  id: string;
  name: string;
  role?: string;
}

export interface OrgListProps {
  orgs: OrgListItem[];
  emptyLabel: string;
  defaultRoleLabel: string;
  onPressOrg?: (orgId: string) => void;
}

export function OrgList({ orgs, emptyLabel, defaultRoleLabel, onPressOrg }: OrgListProps) {
  if (orgs.length === 0) {
    return (
      <View className="px-4">
        <Text tone="muted">{emptyLabel}</Text>
      </View>
    );
  }
  return (
    <VStack gap={2} className="px-4">
      {orgs.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onPressOrg?.(o.id)}
          accessibilityRole="button"
          accessibilityLabel={o.name}
        >
          <View className="flex-row items-center bg-surface border border-subtle rounded-xl p-3">
            <View className="w-9 h-9 rounded-full bg-subtle items-center justify-center mr-3">
              <Ionicons name="people" size={20} color="#64748b" />
            </View>
            <View className="flex-1">
              <Text className="font-semibold" numberOfLines={1}>{o.name}</Text>
              <Text variant="caption" tone="muted">{o.role ?? defaultRoleLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </View>
        </Pressable>
      ))}
    </VStack>
  );
}
