import { View } from 'react-native';
import { formatRelativeTime } from '@cultuvilla/shared/utils/format';
import { HStack } from '../primitives/HStack';
import { VStack } from '../primitives/VStack';
import { Text } from '../primitives/Text';

export interface NotificationRowProps {
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
  testID?: string;
}

/**
 * Read-only row for the Buzón activity feed. Pure presentation — no
 * Firestore, no actions. Title/body arrive already resolved (Spanish) on
 * the notification doc, so this component does not route them through
 * i18n.
 */
export function NotificationRow({ title, body, read, createdAt, testID }: NotificationRowProps) {
  return (
    <HStack
      gap={3}
      align="start"
      className="bg-surface border-b border-subtle px-4 py-3"
      testID={testID}
    >
      {!read && (
        <View
          testID="notification-unread-dot"
          className="mt-2 h-2 w-2 rounded-full bg-accent"
          accessibilityLabel="No leído"
        />
      )}
      <VStack gap={1} className="flex-1">
        <Text variant="bodySm" tone={read ? 'muted' : 'primary'} className="font-semibold">
          {title}
        </Text>
        <Text variant="bodySm" tone="muted">
          {body}
        </Text>
        <Text variant="caption" tone="muted">
          {formatRelativeTime(createdAt)}
        </Text>
      </VStack>
    </HStack>
  );
}
