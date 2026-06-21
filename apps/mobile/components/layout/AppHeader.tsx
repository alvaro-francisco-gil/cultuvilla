import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
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
  /** Extra content rendered in the right slot, before the notifications/menu icons. */
  extraRightSlot?: ReactNode;
};

export function AppHeader({ centerLabel, extraRightSlot }: AppHeaderProps) {
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
      <StatusBar style="light" />
      <View
        className="bg-accent"
        style={{ paddingTop: insets.top }}
      >
        <View className="flex-row items-center px-3 pt-1 pb-3">
          <View className="flex-1">
            <Text
              variant="h3"
              tone="onAccent"
              numberOfLines={1}
              style={{ fontFamily: 'Fraunces_700Bold', letterSpacing: 0.3 }}
            >
              {label}
            </Text>
          </View>

          <View className="flex-row items-center gap-1">
            {extraRightSlot}
            <Pressable
              onPress={() => {
                // notifications surface not built yet
              }}
              accessibilityLabel={t('header.openNotifications')}
              className="p-1"
            >
              <Ionicons name="notifications" size={28} color="#f9f0e8" />
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityLabel={t('header.openMenu')}
              className="p-1 -mr-1"
            >
              <Ionicons name="menu-sharp" size={30} color="#f9f0e8" />
            </Pressable>
          </View>
        </View>
      </View>
      <UserMenuModal visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
