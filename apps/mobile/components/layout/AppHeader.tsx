import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { UserMenuModal } from '../feature/UserMenuModal';

export type AppHeaderProps = {
  /** Optional override for the title (defaults to active municipality name). */
  centerLabel?: string;
};

export function AppHeader({ centerLabel }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { t } = useT();
  const [municipalityName, setMunicipalityName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = profile?.activeMunicipalityId;
    if (!id) {
      setMunicipalityName(null);
      return;
    }
    getMunicipality(id).then((m) => {
      if (!cancelled) setMunicipalityName(m?.name ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.activeMunicipalityId]);

  const label = centerLabel ?? municipalityName ?? t('header.noVillage');

  return (
    <>
      <View
        className="bg-surface border-b border-subtle"
        style={{ paddingTop: insets.top }}
      >
        <View className="h-11 flex-row items-center px-4">
          <View className="flex-1">
            <Text variant="h3" numberOfLines={1}>
              {label}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => {
                // notifications surface not built yet
              }}
              accessibilityLabel={t('header.openNotifications')}
              className="p-1"
            >
              <Ionicons name="notifications-outline" size={24} color="#0f172a" />
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityLabel={t('header.openMenu')}
              className="p-1 -mr-1"
            >
              <Ionicons name="menu" size={24} color="#0f172a" />
            </Pressable>
          </View>
        </View>
      </View>
      <UserMenuModal visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
