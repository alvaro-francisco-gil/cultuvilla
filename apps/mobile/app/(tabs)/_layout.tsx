import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { t } = useT();

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#bb5d3a',
        tabBarInactiveTintColor: '#a6a897',
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: { height: 64 },
        tabBarLabelStyle: { fontSize: 11, marginTop: 0, paddingTop: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.explora'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'compass' : 'compass-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="village"
        options={{
          title: t('tabs.village'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
