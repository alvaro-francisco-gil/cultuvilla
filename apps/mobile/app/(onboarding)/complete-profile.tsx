import { useState } from 'react';
import { router } from 'expo-router';
import { Screen, VStack, Text, Input, Button } from '../../components/primitives';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { createUserProfile } from '@cultuvilla/shared/services/userService';

function parseBirthday(value: string): Date | null {
  const m = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  if (date > new Date()) return null;
  return date;
}

export default function CompleteProfileScreen() {
  const { user, refreshProfile } = useAuth();
  const { t } = useT();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [birthday, setBirthday] = useState('');
  const [telephone, setTelephone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!user) return;
    setError(null);
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError(t('onboarding.completeProfile.error'));
      return;
    }
    const parsed = parseBirthday(birthday);
    if (!parsed) {
      setError(t('onboarding.completeProfile.error'));
      return;
    }
    setLoading(true);
    try {
      await createUserProfile(user.uid, {
        displayName: trimmedName,
        email: user.email ?? '',
        birthday: parsed,
        telephone: telephone.trim() || null,
      });
      await refreshProfile();
      // Use a typed-routes-safe path; "/" can fail under typedRoutes with the
      // (tabs) group as the only index. Land directly on the explora tab.
      router.replace({ pathname: '/(tabs)' });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('onboarding.completeProfile.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <VStack gap={4}>
        <Text variant="h2">{t('onboarding.completeProfile.title')}</Text>
        <Text tone="muted">{t('onboarding.completeProfile.intro')}</Text>
        <Input
          label={t('onboarding.completeProfile.displayName')}
          value={displayName}
          onChangeText={setDisplayName}
        />
        <Input
          label={`${t('onboarding.completeProfile.birthday')} (DD/MM/AAAA)`}
          value={birthday}
          onChangeText={setBirthday}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
        />
        <Input
          label={t('onboarding.completeProfile.telephone')}
          value={telephone}
          onChangeText={setTelephone}
          keyboardType="phone-pad"
        />
        {error && <Text tone="danger">{error}</Text>}
        <Button onPress={onSubmit} loading={loading} fullWidth>
          <Text tone="onAccent">{t('onboarding.completeProfile.submit')}</Text>
        </Button>
      </VStack>
    </Screen>
  );
}
