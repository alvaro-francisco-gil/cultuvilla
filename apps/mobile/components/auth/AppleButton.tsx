import * as AppleAuthentication from 'expo-apple-authentication';

export type AppleButtonProps = {
  onPress: () => void;
  testID?: string;
};

// Apple requires its own button component (not a custom-styled Pressable)
// for Sign in with Apple — this is the HIG-compliant control, not a design
// choice. iOS-only; callers must gate rendering on Platform.OS === 'ios'.
export function AppleButton({ onPress, testID }: AppleButtonProps) {
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={8}
      style={{ height: 56 }}
      onPress={onPress}
      testID={testID}
    />
  );
}
