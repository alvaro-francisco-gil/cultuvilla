import { useEffect, useRef } from 'react';
import { Modal, View, Animated, Dimensions, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { Button } from '../primitives/Button';
import { VStack } from '../primitives/VStack';
import { useT } from '../../lib/i18n';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type RegisterSheetProps = {
  visible: boolean;
  reason?: string;
  onRegister: () => void;
  onDismiss: () => void;
};

export function RegisterSheet({ visible, reason, onRegister, onDismiss }: RegisterSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  // useNativeDriver:false — RN-Web has shipped translateY springs that don't
  // move on web with the native driver (mobile-web-compat).
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 260, useNativeDriver: false }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: false }),
      ]).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
      fadeAnim.setValue(0);
    }
  }, [visible, slideAnim, fadeAnim]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: fadeAnim }]}>
        <Pressable onPress={onDismiss} accessibilityLabel={t('guest.dismiss')} style={StyleSheet.absoluteFill}>
          <View />
        </Pressable>
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingBottom: insets.bottom + 16,
            backgroundColor: '#ffffff', // colors.ts: light.bg.base (white)
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View
            style={{
              width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2,
              alignSelf: 'center', marginTop: 12, marginBottom: 8,
            }}
          />
          <VStack gap={3} className="px-5 pt-2">
            <Text variant="h3">{t('guest.title')}</Text>
            {reason ? <Text tone="muted">{reason}</Text> : null}
            <Button variant="primary" fullWidth onPress={onRegister}>
              {t('guest.register')}
            </Button>
            <Pressable onPress={onDismiss} accessibilityLabel={t('guest.dismiss')} className="items-center py-2">
              <Text tone="muted">{t('guest.dismiss')}</Text>
            </Pressable>
          </VStack>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
