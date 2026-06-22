import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth/useAuth';
import { webSpread } from '../../lib/platform';
import { useT } from '../../lib/i18n';

// Web-only tab-bar metrics: RN-Web's text line-height clips labels with the
// react-navigation defaults. On native, the defaults correctly account for
// safe-area insets (home indicator on iOS, gesture bar on Android), so the
// override must be web-gated — otherwise it hides the bar on Android and
// crowds the iPhone home indicator.
const webTabBarOverrides = webSpread({
  tabBarShowLabel: true,
  tabBarLabelPosition: 'below-icon' as const,
  tabBarStyle: { height: 64 },
  tabBarLabelStyle: { fontSize: 11, marginTop: 0, paddingTop: 0 },
});

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { t } = useT();

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Crossfade between tabs so the shared header/stats/buttons appear to
        // stay put while only the content swaps (village ↔ profile share a layout).
        animation: 'fade',
        tabBarActiveTintColor: '#bb5d3a',
        tabBarInactiveTintColor: '#a6a897',
        ...webTabBarOverrides,
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
