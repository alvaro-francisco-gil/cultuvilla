import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input, type InputProps } from './Input';
import { Pressable } from './Pressable';

export type PasswordInputProps = Omit<InputProps, 'secureTextEntry'> & {
  testID?: string;
};

export function PasswordInput({ testID, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.row}>
      <View style={styles.input}>
        <Input {...rest} secureTextEntry={!visible} testID={testID ? `${testID}-input` : undefined} />
      </View>
      <Pressable
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        testID={testID ? `${testID}-toggle` : undefined}
        style={styles.toggle}
      >
        <Ionicons name={visible ? 'eye-off' : 'eye'} size={20} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'relative' },
  input: { flex: 1 },
  toggle: { position: 'absolute', right: 12, bottom: 12 },
});
