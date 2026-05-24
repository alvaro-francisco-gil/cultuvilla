import { useState } from 'react';
import { Link, router } from 'expo-router';
import { Screen, VStack, Text, Input, Button } from '../../components/primitives';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';

export default function LoginScreen() {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <Screen>
      <VStack gap={4}>
        <Text variant="h2">{t('auth.login.title')}</Text>
        <Input
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error != null && <Text tone="danger">{error}</Text>}
        <Button onPress={onSubmit} loading={loading} fullWidth>
          <Text tone="onAccent">{t('auth.login.submit')}</Text>
        </Button>
        <Button onPress={onGoogle} loading={googleLoading} variant="secondary" fullWidth>
          <Text>{t('auth.signInWithGoogle')}</Text>
        </Button>
        <Link href="/signup">
          <Text tone="muted">{t('auth.login.toSignup')}</Text>
        </Link>
      </VStack>
    </Screen>
  );
}
