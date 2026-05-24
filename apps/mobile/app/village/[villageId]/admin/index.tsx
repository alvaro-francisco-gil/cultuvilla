import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, VStack, Text, Pressable } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';

export default function VillageAdminHub() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const base = `/village/${villageId}/admin` as const;

  const items: Array<{ href: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
    { href: `${base}/community`, icon: 'home-outline', label: t('village.admin.hub.community') },
    { href: `${base}/barrios`, icon: 'map-outline', label: t('village.admin.hub.barrios') },
    { href: `${base}/cemeteries`, icon: 'leaf-outline', label: t('village.admin.hub.cemeteries') },
    { href: `${base}/organizations`, icon: 'business-outline', label: t('village.admin.hub.organizations') },
    { href: `${base}/invite-tokens`, icon: 'link-outline', label: t('village.admin.hub.invites') },
    { href: `${base}/censo`, icon: 'list-outline', label: t('village.admin.hub.censo') },
    { href: `${base}/requests`, icon: 'people-outline', label: t('village.admin.hub.joinRequests') },
  ];

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.title')} />
      <VStack gap={2} className="p-4">
        {items.map((it) => (
          <Pressable
            key={it.href}
            onPress={() => router.push(it.href as never)}
            className="flex-row items-center bg-surface border border-subtle rounded-xl p-3"
          >
            <Ionicons name={it.icon} size={20} color="#0f172a" />
            <Text className="ml-3 flex-1">{it.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </Pressable>
        ))}
      </VStack>
    </Screen>
  );
}
