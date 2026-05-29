import { Image, View } from 'react-native';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { useT } from '../../lib/i18n';

const GOOGLE_G = require('../../assets/google-g.jpg');

export type GoogleButtonProps = {
  onPress: () => void;
  loading?: boolean;
  testID?: string;
};

export function GoogleButton({ onPress, loading = false, testID }: GoogleButtonProps) {
  const { t } = useT();
  const label = loading ? t('auth.googleConnecting') : t('auth.signInWithGoogle');
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={t('auth.signInWithGoogle')}
      testID={testID}
      className="bg-surface border border-subtle rounded-md h-14 px-4 justify-center"
    >
      <View className="flex-row items-center justify-center">
        <Image
          source={GOOGLE_G}
          style={{ width: 22, height: 22, marginRight: 12, resizeMode: 'contain' }}
        />
        <Text>{label}</Text>
      </View>
    </Pressable>
  );
}
