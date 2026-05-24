import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { useT } from '../../lib/i18n';

export type ScreenHeaderProps = {
  title?: string;
  /** Custom back handler (defaults to router.back). */
  onBack?: () => void;
  /** Hide the back button entirely. */
  hideBack?: boolean;
  /** Optional content rendered on the right (icon buttons, etc.). */
  rightSlot?: ReactNode;
};

export function ScreenHeader({ title, onBack, hideBack = false, rightSlot }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const handleBack = onBack ?? (() => router.back());

  return (
    <View
      className="bg-surface border-b border-subtle"
      style={{ paddingTop: insets.top }}
    >
      <View className="h-14 flex-row items-center px-4">
        <View className="w-12 items-start">
          {!hideBack ? (
            <Pressable
              onPress={handleBack}
              accessibilityLabel={t('header.back')}
              className="p-2 -ml-2"
            >
              <Ionicons name="chevron-back" size={26} color="#0f172a" />
            </Pressable>
          ) : null}
        </View>
        <View className="flex-1 items-center">
          {title ? (
            <Text variant="h3" numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
        <View className="w-12 items-end flex-row justify-end">{rightSlot}</View>
      </View>
    </View>
  );
}
