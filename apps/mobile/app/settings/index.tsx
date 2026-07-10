import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { iconSizes } from '@cultuvilla/shared/design-system';
import { Screen } from '../../components/primitives/Screen';
import { Card } from '../../components/primitives/Card';
import { Pressable } from '../../components/primitives/Pressable';
import { Text } from '../../components/primitives/Text';
import { VStack } from '../../components/primitives/VStack';
import { HStack } from '../../components/primitives/HStack';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';

export default function SettingsScreen() {
  const { profile, canChangeEmail } = useAuth();
  const { t } = useT();

  const changeEmailDisabled = !canChangeEmail;
  const displayName = profile?.displayName ?? '';
  const email = profile?.email ?? '';

  return (
    <Screen padded={false} scroll>
      <ScreenHeader title={t('settings.title')} />
      <VStack gap={6} className="p-4">
        <VStack gap={1}>
          {displayName ? <Text variant="h3">{displayName}</Text> : null}
          {email ? (
            <Text variant="body" tone="muted">
              {email}
            </Text>
          ) : null}
        </VStack>

        <VStack gap={2}>
          <Text variant="caption" tone="muted" className="uppercase">
            {t('settings.section.account')}
          </Text>
          <Card variant="flat" className="p-0">
            <Pressable
              onPress={() => router.push('/settings/change-email')}
              disabled={changeEmailDisabled}
              className="px-4 py-3 border-b border-subtle"
            >
              <HStack justify="between" align="center">
                <Text tone={changeEmailDisabled ? 'muted' : 'primary'}>
                  {t('settings.changeEmail.label')}
                </Text>
                {!changeEmailDisabled ? (
                  <Ionicons name="chevron-forward" size={iconSizes.sm} color="#cbd5e1" />
                ) : null}
              </HStack>
              {changeEmailDisabled ? (
                <Text variant="caption" tone="muted" className="mt-1">
                  {t('settings.changeEmail.googleDisabledHint')}
                </Text>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => router.push('/settings/delete-account')}
              className="px-4 py-3"
            >
              <HStack justify="between" align="center">
                <Text tone="danger">{t('settings.deleteAccount.label')}</Text>
                <Ionicons name="chevron-forward" size={iconSizes.sm} color="#cbd5e1" />
              </HStack>
            </Pressable>
          </Card>
        </VStack>
      </VStack>
    </Screen>
  );
}
