import { View } from 'react-native';
import { Text } from '../../primitives';

export function ProfileSectionHeader({ title }: { title: string }) {
  return (
    <View className="px-4 pt-6 pb-2">
      <Text variant="h3" className="font-bold">{title}</Text>
    </View>
  );
}
