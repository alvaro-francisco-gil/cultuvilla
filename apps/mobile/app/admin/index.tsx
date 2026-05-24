import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, VStack, Text } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useT } from '../../lib/i18n';

type CardSpec = {
  href: '/admin/activate-village' | '/admin/organizer-requests' | '/admin/occupations';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
};

export default function AdminHubScreen() {
  const { t } = useT();
  const cards: CardSpec[] = [
    {
      href: '/admin/activate-village',
      icon: 'flag-outline',
      title: t('admin.hub.activateVillage'),
      hint: t('admin.hub.activateVillageHint'),
    },
    {
      href: '/admin/organizer-requests',
      icon: 'person-add-outline',
      title: t('admin.hub.organizerRequests'),
      hint: t('admin.hub.organizerRequestsHint'),
    },
    {
      href: '/admin/occupations',
      icon: 'briefcase-outline',
      title: t('admin.hub.occupations'),
      hint: t('admin.hub.occupationsHint'),
    },
  ];

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('admin.title')} />
      <VStack gap={3} className="p-4">
        {cards.map((c) => (
          <Pressable
            key={c.href}
            onPress={() => router.push(c.href)}
            className="bg-surface border border-subtle rounded-xl p-4 flex-row items-center"
          >
            <View className="w-10 h-10 rounded-xl bg-blue-100 items-center justify-center mr-3">
              <Ionicons name={c.icon} size={20} color="#1d4ed8" />
            </View>
            <View className="flex-1">
              <Text variant="h3">{c.title}</Text>
              <Text className="text-muted text-sm">{c.hint}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>
        ))}
      </VStack>
    </Screen>
  );
}
