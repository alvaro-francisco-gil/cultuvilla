import { View } from 'react-native';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { useT } from '../../lib/i18n';

export type ForgotPasswordLinkProps = { onPress: () => void };

export function ForgotPasswordLink({ onPress }: ForgotPasswordLinkProps) {
  const { t } = useT();
  return (
    <View className="items-end">
      <Pressable onPress={onPress} accessibilityRole="button">
        <Text tone="muted" variant="bodySm">
          {t('auth.forgotPassword')}
        </Text>
      </Pressable>
    </View>
  );
}
