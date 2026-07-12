import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, VStack, Text } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useT } from '../../lib/i18n';

type CardSpec = {
  href: '/admin/organizer-requests';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
};

export default function AdminHubScreen() {
  const { t } = useT();
  const cards: CardSpec[] = [
    {
      href: '/admin/organizer-requests',
      icon: 'person-add-outline',
      title: t('admin.hub.organizerRequests'),
      hint: t('admin.hub.organizerRequestsHint'),
    },
  ];

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('admin.title')} />
      <VStack gap={2} className="p-4">
        {cards.map((c) => (
          <Pressable
            key={c.href}
            onPress={() => router.push(c.href)}
            className="flex-row items-center bg-surface border border-subtle rounded-xl p-3"
          >
            <Ionicons name={c.icon} size={20} color="#0f172a" />
            <View className="ml-3 flex-1">
              <Text>{c.title}</Text>
              <Text tone="muted" variant="caption">{c.hint}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </Pressable>
        ))}
      </VStack>
    </Screen>
  );
}
