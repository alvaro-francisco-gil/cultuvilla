import { View } from 'react-native';
import { Text } from './Text';
import { VStack } from './VStack';
import { Button } from './Button';
import { useT } from '../../lib/i18n';

export interface ErrorStateProps {
  /** Optional heading; defaults to the shared `common.error.title`. */
  title?: string;
  /** Optional body; defaults to the shared `common.error.body`. */
  message?: string;
  /** When provided, renders a retry button wired to this callback. */
  onRetry?: () => void | Promise<void>;
}

/**
 * Friendly, localized full-area error state. Use in place of dumping a raw
 * exception message into the UI: the technical error should still be logged to
 * the console for devs, while the user sees this. Pass `onRetry` to surface a
 * "Reintentar" button (e.g. a hook's `reload`).
 */
export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  const { t } = useT();
  return (
    <View className="flex-1 items-center justify-center px-8">
      <VStack gap={2} className="items-center">
        <Text variant="h3" tone="danger" className="text-center">
          {title ?? t('common.error.title')}
        </Text>
        <Text tone="muted" className="text-center">
          {message ?? t('common.error.body')}
        </Text>
        {onRetry ? (
          <Button variant="secondary" className="mt-2" onPress={() => void onRetry()}>
            {t('common.error.retry')}
          </Button>
        ) : null}
      </VStack>
    </View>
  );
}
