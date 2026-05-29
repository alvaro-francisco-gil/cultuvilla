import { Image, View } from 'react-native';
import { Text } from '../primitives/Text';

const APP_LOGO = require('../../assets/icon.png');

export type AuthHeaderProps = { title: string };

export function AuthHeader({ title }: AuthHeaderProps) {
  return (
    <View className="items-center mb-4">
      <Image
        source={APP_LOGO}
        accessibilityLabel="Cultuvilla"
        style={{ width: 96, height: 96, borderRadius: 20, resizeMode: 'contain' }}
      />
      <Text variant="h2" className="text-center mt-4">
        {title}
      </Text>
    </View>
  );
}
