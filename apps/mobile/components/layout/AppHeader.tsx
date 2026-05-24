import { useEffect, useState } from 'react';
import { View, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { UserMenuModal } from '../feature/UserMenuModal';

export type AppHeaderProps = {
  /** Optional override for the center label (defaults to active municipality name). */
  centerLabel?: string;
  /** Hide the avatar on the right (used on the Profile tab to avoid redundancy). */
  hideAvatar?: boolean;
};

export function AppHeader({ centerLabel, hideAvatar = false }: AppHeaderProps) {
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
  const photoURL = profile?.photoURL ?? null;

  return (
    <>
      <View
        className="bg-surface border-b border-subtle"
        style={{ paddingTop: insets.top }}
      >
        <View className="h-14 flex-row items-center px-4">
          <View className="w-12 items-start">
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityLabel={t('header.openMenu')}
              className="p-2 -ml-2"
            >
              <Ionicons name="menu" size={26} color="#0f172a" />
            </Pressable>
          </View>

          <View className="flex-1 items-center">
            <Text variant="h3" numberOfLines={1}>
              {label}
            </Text>
          </View>

          <View className="w-12 items-end">
            {!hideAvatar ? (
              <Pressable
                onPress={() => router.push('/(tabs)/profile')}
                accessibilityLabel={t('header.openProfile')}
                className="p-1"
              >
                {photoURL ? (
                  <Image
                    source={{ uri: photoURL }}
                    style={{ width: 32, height: 32, borderRadius: 16 }}
                  />
                ) : (
                  <View className="w-8 h-8 rounded-[16px] bg-subtle items-center justify-center">
                    <Ionicons name="person" size={18} color="#64748b" />
                  </View>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
      <UserMenuModal visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
