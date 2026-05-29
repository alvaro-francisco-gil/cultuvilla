import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Screen } from '../primitives/Screen';

export type AuthCardProps = { children: ReactNode };

export function AuthCard({ children }: AuthCardProps) {
  return (
    <Screen scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View className="flex-1 items-center justify-center">
          <View style={{ maxWidth: 360, width: '100%', alignSelf: 'center' }}>
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
