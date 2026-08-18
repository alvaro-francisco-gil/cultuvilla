import { useState } from 'react';
import { Button, Input, Text, VStack } from '../../components/primitives';
import {
  AuthCard,
  AuthHeader,
  GoogleButton,
  OrDivider,
} from '../../components/auth';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';

type Step = 'email' | 'code';

export default function LoginScreen() {
  const { sendOtpCode, verifyOtpCode, signInWithGoogle } = useAuth();
  const { t } = useT();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSendCode() {
    setError(null);
    setSendLoading(true);
    try {
      await sendOtpCode(email);
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    } finally {
      setSendLoading(false);
    }
  }

  async function onVerifyCode() {
    setError(null);
    setVerifyLoading(true);
    try {
      await verifyOtpCode(email, code);
      // AuthGate (app/_layout.tsx) picks up the auth state change and routes.
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    } finally {
      setVerifyLoading(false);
    }
  }

  // A typo in the address is only visible once the code screen names it, so
  // the code step must be able to go back — otherwise the only way out of a
  // wrong email is to verify it and get stuck behind the onboarding gate.
  function onChangeEmail() {
    setError(null);
    setCode('');
    setStep('email');
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

  if (step === 'code') {
    return (
      <AuthCard>
        <AuthHeader title={t('auth.login.title')} />
        <VStack gap={3}>
          <Text tone="muted" testID="login-code-sent">
            {t('auth.otp.sent', { email })}
          </Text>
          <Input
            label={t('auth.otp.codeLabel')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            testID="login-code-input"
          />
          {error != null && <Text tone="danger">{error}</Text>}
          <Button onPress={onVerifyCode} loading={verifyLoading} fullWidth testID="login-verify-code">
            {t('auth.otp.verify')}
          </Button>
          <Button variant="ghost" onPress={onSendCode} loading={sendLoading} fullWidth testID="login-resend-code">
            {t('auth.otp.resend')}
          </Button>
          <Button variant="ghost" onPress={onChangeEmail} fullWidth testID="login-change-email">
            {t('auth.otp.changeEmail')}
          </Button>
        </VStack>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthHeader title={t('auth.login.title')} />
      <VStack gap={3}>
        <Input
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Text tone="muted" variant="bodySm">
          {t('auth.otp.hint')}
        </Text>
        {error != null && <Text tone="danger">{error}</Text>}
        <Button onPress={onSendCode} loading={sendLoading} fullWidth testID="login-submit">
          {t('auth.login.submit')}
        </Button>
        <OrDivider />
        <GoogleButton onPress={onGoogle} loading={googleLoading} testID="login-google-button" />
      </VStack>
    </AuthCard>
  );
}
