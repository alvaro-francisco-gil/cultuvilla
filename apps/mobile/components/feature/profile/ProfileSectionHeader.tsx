import { View } from 'react-native';
import { SectionTitle } from '../SectionTitle';

export function ProfileSectionHeader({ title }: { title: string }) {
  return (
    <View className="px-4 pt-6 pb-2">
      <SectionTitle>{title}</SectionTitle>
    </View>
  );
}
