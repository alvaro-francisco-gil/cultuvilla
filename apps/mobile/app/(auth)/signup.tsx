import { useState } from 'react';
import { Link } from 'expo-router';
import { Screen, VStack, Text, Input, PasswordInput, Button } from '../../components/primitives';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';

export default function SignupScreen() {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
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
      await signUpWithEmail(email, password);
      // AuthGate (app/_layout.tsx) handles the redirect once the user's
      // profile state settles. Calling router.replace here races with its
      // Stack unmount and dispatches into a missing navigator.
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
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <Screen>
      <VStack gap={4}>
        <Text variant="h2">{t('auth.signup.title')}</Text>
        <Input
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <PasswordInput
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          testID="signup-password"
        />
        <Text tone="muted">{t('auth.passwordHint')}</Text>
        {error != null && <Text tone="danger">{error}</Text>}
        <Button onPress={onSubmit} loading={loading} fullWidth>
          {t('auth.signup.submit')}
        </Button>
        <Button onPress={onGoogle} loading={googleLoading} variant="secondary" fullWidth>
          {t('auth.signInWithGoogle')}
        </Button>
        <Link href="/login">
          <Text tone="muted">{t('auth.signup.toLogin')}</Text>
        </Link>
      </VStack>
    </Screen>
  );
}
