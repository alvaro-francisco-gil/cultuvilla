import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth/useAuth';

export default function Index() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(tabs)/explora" />;
}
