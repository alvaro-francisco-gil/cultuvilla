import { Image, View } from 'react-native';
import { Text } from '../primitives/Text';

const APP_LOGO = require('../../assets/logo.png');

export type AuthHeaderProps = { title: string };

export function AuthHeader({ title }: AuthHeaderProps) {
  return (
    <View className="items-center mb-6">
      <Image
        source={APP_LOGO}
        accessibilityLabel="Cultuvilla"
        style={{ width: 132, height: 132, resizeMode: 'contain' }}
      />
      <Text variant="display" className="text-center text-accent mt-4">
        {title}
      </Text>
    </View>
  );
}
