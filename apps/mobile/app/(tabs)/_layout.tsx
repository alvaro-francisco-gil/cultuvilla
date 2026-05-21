import { useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';

export default function TabsLayout() {
  const { user, loading, profile } = useAuth();
  const { t } = useT();
  const [activeName, setActiveName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = profile?.activeMunicipalityId;
    if (!id) {
      setActiveName(null);
      return;
    }
    getMunicipality(id).then((m) => {
      if (!cancelled) setActiveName(m?.name ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.activeMunicipalityId]);

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;

  const middleLabel = activeName ?? t('tabs.findVillage');
  const middleIcon = activeName ? 'home-outline' : 'search-outline';

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.explora'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="village"
        options={{
          title: middleLabel,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={middleIcon} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
