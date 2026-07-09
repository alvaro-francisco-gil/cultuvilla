import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Button, Input, Text, VStack } from '../../components/primitives';
import { AuthCard, AuthHeader } from '../../components/auth';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';

type Status = 'pending' | 'needs-email' | 'completing' | 'error' | 'done' | 'reauth-done';

async function readIncomingUrl(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null;
    return window.location.href;
  }
  return Linking.getInitialURL();
}

export default function FinishScreen() {
  const { isEmailLink, completeEmailLinkSignIn, readPendingEmail, completeReauth, readPendingReauth } =
    useAuth();
  const { t } = useT();
  const [status, setStatus] = useState<Status>('pending');
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const incomingUrlRef = useRef<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    void (async () => {
      const url = await readIncomingUrl();
      incomingUrlRef.current = url;
      if (!url || !isEmailLink(url)) {
        setStatus('error');
        setError(t('auth.emailLink.invalid'));
        return;
      }
      // A re-auth link (sent to the CURRENT email by changeEmail) and a
      // sign-in link both satisfy isEmailLink — the pending-reauth intent is
      // what distinguishes them, so check it first.
      const pendingReauth = await readPendingReauth();
      if (pendingReauth) {
        setStatus('completing');
        try {
          await completeReauth(url);
          setStatus('reauth-done');
          router.replace('/settings');
        } catch (e) {
          setStatus('error');
          setError(e instanceof Error ? e.message : t('auth.error.unknown'));
        }
        return;
      }
      const stored = await readPendingEmail();
      if (stored) {
        await tryComplete(url, stored);
      } else {
        setStatus('needs-email');
      }
    })();
  }, [isEmailLink, readPendingEmail, readPendingReauth, completeReauth, t]);

  async function tryComplete(url: string, emailToUse: string) {
    setStatus('completing');
    setError(null);
    try {
      await completeEmailLinkSignIn(url, emailToUse);
      setStatus('done');
      // AuthGate (app/_layout.tsx) picks up the auth state change and routes.
    } catch (e) {
      setStatus('needs-email');
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    }
  }

  async function onConfirmEmail() {
    const url = incomingUrlRef.current;
    if (!url) return;
    await tryComplete(url, email);
  }

  if (status === 'pending' || status === 'completing' || status === 'done' || status === 'reauth-done') {
    return (
      <AuthCard>
        <View className="items-center pt-8">
          <ActivityIndicator />
          <Text tone="muted" className="mt-4">
            {t('auth.emailLink.completing')}
          </Text>
        </View>
      </AuthCard>
    );
  }

  if (status === 'error') {
    return (
      <AuthCard>
        <AuthHeader title={t('auth.emailLink.invalidTitle')} />
        <Text tone="danger">{error ?? t('auth.emailLink.invalid')}</Text>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthHeader title={t('auth.emailLink.confirmTitle')} />
      <VStack gap={3}>
        <Text tone="muted">{t('auth.emailLink.confirmHint')}</Text>
        <Input
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        {error != null && <Text tone="danger">{error}</Text>}
        <Button onPress={onConfirmEmail} fullWidth testID="finish-confirm">
          {t('auth.emailLink.confirmCta')}
        </Button>
      </VStack>
    </AuthCard>
  );
}
