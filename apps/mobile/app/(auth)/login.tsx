import { useState } from 'react';
import { Link } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { getAuth } from '@cultuvilla/shared/firebase';
import { Button, Input, PasswordInput, Text, VStack } from '../../components/primitives';
import {
  AuthCard,
  AuthHeader,
  ForgotPasswordLink,
  GoogleButton,
  OrDivider,
} from '../../components/auth';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';

export default function LoginScreen() {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      // Routing is owned by AuthGate (app/_layout.tsx) — calling router.replace
      // here races with the AuthGate Stack unmount while the user's Firestore
      // profile is loading and dispatches into a navigator that doesn't exist.
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setInfo(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function onForgot() {
    setError(null);
    setInfo(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError(t('auth.forgotPasswordNeedsEmail'));
      return;
    }
    try {
      await sendPasswordResetEmail(getAuth(), trimmed);
      setInfo(t('auth.forgotPasswordSent'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    }
  }

  return (
    <AuthCard>
      <AuthHeader title={t('auth.login.title')} />
      <VStack gap={3}>
        <Input
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <PasswordInput
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          testID="login-password"
        />
        <ForgotPasswordLink onPress={onForgot} />
        {error != null && <Text tone="danger">{error}</Text>}
        {info != null && <Text tone="muted">{info}</Text>}
        <Button onPress={onSubmit} loading={loading} fullWidth testID="login-submit">
          {t('auth.login.submit')}
        </Button>
        <OrDivider />
        <GoogleButton onPress={onGoogle} loading={googleLoading} testID="login-google-button" />
        <Link href="/signup">
          <Text tone="muted" className="text-center">
            {t('auth.login.toSignup')}
          </Text>
        </Link>
      </VStack>
    </AuthCard>
  );
}
