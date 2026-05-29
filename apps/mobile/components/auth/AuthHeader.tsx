import { Image, View } from 'react-native';
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
        className="text-center text-accent mt-10"
        style={{ fontWeight: '800' }}
      >
        {title}
      </Text>
    </View>
  );
}
