import { useState } from 'react';
import { Link } from 'expo-router';
import { Button, Input, Text, VStack } from '../../components/primitives';
import {
  AuthCard,
  AuthHeader,
  GoogleButton,
  OrDivider,
} from '../../components/auth';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';

export default function SignupScreen() {
  const { sendEmailLink, signInWithGoogle } = useAuth();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setSent(false);
    setLoading(true);
    try {
      await sendEmailLink(email);
      setSent(true);
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
    <AuthCard>
      <AuthHeader title={t('auth.signup.title')} />
      <VStack gap={3}>
        <Input
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Text tone="muted" variant="bodySm">
          {t('auth.emailLinkHint')}
        </Text>
        {error != null && <Text tone="danger">{error}</Text>}
        {sent && (
          <Text tone="muted" testID="signup-link-sent">
            {t('auth.emailLinkSent', { email })}
          </Text>
        )}
        <Button onPress={onSubmit} loading={loading} fullWidth testID="signup-submit">
          {t('auth.signup.submit')}
        </Button>
        <OrDivider />
        <GoogleButton onPress={onGoogle} loading={googleLoading} testID="signup-google-button" />
        <Link href="/login">
          <Text tone="muted" className="text-center">
            {t('auth.signup.toLogin')}
          </Text>
        </Link>
      </VStack>
    </AuthCard>
  );
}
