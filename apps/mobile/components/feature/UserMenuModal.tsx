import { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  Share,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type UserMenuModalProps = {
  visible: boolean;
  onClose: () => void;
};

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

export function UserMenuModal({ visible, onClose }: UserMenuModalProps) {
  const { profile, signOut } = useAuth();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
      fadeAnim.setValue(0);
    }
  }, [visible, slideAnim, fadeAnim]);

  function close(after?: () => void) {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 240, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start(() => {
      onClose();
      after?.();
    });
  }

  const sections: MenuSection[] = [
    {
      title: t('menu.section.account'),
      items: [
        {
          icon: 'person-circle-outline',
          label: t('menu.editProfile'),
          onPress: () => close(() => router.push('/(tabs)/profile')),
        },
        {
          icon: 'home-outline',
          label: t('menu.myVillage'),
          onPress: () => close(() => router.push('/(tabs)/village')),
        },
        {
          icon: 'search-outline',
          label: t('menu.findVillage'),
          onPress: () => close(() => router.push('/(tabs)/village')),
        },
      ],
    },
    {
      title: t('menu.section.app'),
      items: [
        {
          icon: 'share-social-outline',
          label: t('menu.shareApp'),
          onPress: async () => {
            try {
              await Share.share({ message: t('menu.shareAppMessage') });
            } catch {
              // best-effort
            }
          },
        },
        {
          icon: 'help-circle-outline',
          label: t('menu.help'),
          onPress: async () => {
            try {
              await Linking.openURL('mailto:hola@cultuvilla.com');
            } catch {
              // best-effort
            }
          },
        },
      ],
    },
  ];

  const displayName = profile?.displayName ?? '';
  const email = profile?.email ?? '';
  const photoURL: string | null = null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => close()}>
      <Animated.View
        className="flex-1 bg-black/50"
        style={{ opacity: fadeAnim }}
      >
        <Animated.View
          className="absolute left-0 right-0 bottom-0 bg-surface-elevated"
          style={{ height: SCREEN_HEIGHT, transform: [{ translateY: slideAnim }] }}
        >
          <View
            className="flex-row items-center justify-between px-4 border-b border-subtle"
            style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}
          >
            <Text variant="h2">{t('menu.title')}</Text>
            <Pressable
              onPress={() => close()}
              accessibilityLabel={t('menu.close')}
              className="p-2 -mr-2"
            >
              <Ionicons name="close" size={26} color="#0f172a" />
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          >
            <View className="flex-row items-center gap-3 mb-6">
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={{ width: 56, height: 56, borderRadius: 28 }} />
              ) : (
                <View className="w-14 h-14 rounded-[28px] bg-subtle items-center justify-center">
                  <Ionicons name="person" size={28} color="#64748b" />
                </View>
              )}
              <View className="flex-1">
                {displayName ? (
                  <Text variant="body" className="font-semibold">
                    {displayName}
                  </Text>
                ) : null}
                {email ? (
                  <Text variant="caption" tone="muted">
                    {email}
                  </Text>
                ) : null}
              </View>
            </View>

            {sections.map((section) => (
              <View key={section.title} className="mb-6">
                <Text variant="caption" tone="muted" className="mb-2 uppercase">
                  {section.title}
                </Text>
                <View className="bg-surface rounded-md border border-subtle">
                  {section.items.map((item, idx) => (
                    <Pressable
                      key={item.label}
                      onPress={item.onPress}
                      className={
                        'flex-row items-center px-4 py-3 ' +
                        (idx < section.items.length - 1 ? 'border-b border-subtle' : '')
                      }
                    >
                      <Ionicons name={item.icon} size={22} color="#0f172a" />
                      <Text className="flex-1 ml-3">{item.label}</Text>
                      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

            <Pressable
              onPress={() => close(() => void signOut())}
              className="flex-row items-center justify-center bg-surface rounded-md border border-subtle py-4"
            >
              <Ionicons name="log-out-outline" size={20} color="#dc2626" />
              <Text tone="danger" className="ml-2 font-semibold">
                {t('menu.signOut')}
              </Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
