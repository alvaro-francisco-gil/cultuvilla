import { View } from 'react-native';
import { Text } from '../primitives/Text';
import { useT } from '../../lib/i18n';

export type OrDividerProps = { label?: string };

export function OrDivider({ label }: OrDividerProps) {
  const { t } = useT();
  const text = label ?? t('auth.divider.or');
  return (
    <View className="flex-row items-center justify-center my-2">
      <View className="flex-1 h-px bg-subtle mx-2" />
      <Text tone="muted">{text}</Text>
      <View className="flex-1 h-px bg-subtle mx-2" />
    </View>
  );
}
