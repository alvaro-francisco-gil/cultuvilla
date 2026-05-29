import { Image, View } from 'react-native';
import { colors } from '@cultuvilla/shared/design-system';
import { Text } from '../primitives/Text';

const APP_LOGO = require('../../assets/logo.png');

export type AuthHeaderProps = { title: string };

export function AuthHeader({ title }: AuthHeaderProps) {
  return (
    <View className="mb-2">
      <View className="items-center">
        <Image
          source={APP_LOGO}
          accessibilityLabel="Cultuvilla"
          style={{ width: 132, height: 132, resizeMode: 'contain' }}
        />
      </View>
      <Text
        variant="body"
        className="text-center mt-10"
        style={{ color: colors.light.fg.accent, fontWeight: '800' }}
      >
        {title}
      </Text>
    </View>
  );
}
