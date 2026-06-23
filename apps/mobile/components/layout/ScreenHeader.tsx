import { View } from 'react-native';
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
  /** Override the title color (defaults to theme primary). */
  titleColor?: string;
};

export function ScreenHeader({ title, onBack, hideBack = false, rightSlot, titleColor }: ScreenHeaderProps) {
  const { t } = useT();
  const handleBack = onBack ?? (() => router.back());

  return (
    <View className="bg-surface border-b border-subtle">
      <View className="h-11 flex-row items-center px-4">
        <View className="w-10 items-start">
          {!hideBack ? (
            <Pressable
              onPress={handleBack}
              accessibilityLabel={t('header.back')}
              className="p-1 -ml-1"
            >
              <Ionicons name="chevron-back" size={24} color="#0f172a" />
            </Pressable>
          ) : null}
        </View>
        <View className="flex-1 items-center">
          {title ? (
            <Text variant="h3" numberOfLines={1} style={titleColor ? { color: titleColor } : undefined}>
              {title}
            </Text>
          ) : null}
        </View>
        <View className="w-10 items-end flex-row justify-end">{rightSlot}</View>
      </View>
    </View>
  );
}
