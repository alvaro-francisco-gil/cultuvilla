import { View } from 'react-native';
import type { ProposalStatus } from '@cultuvilla/shared/models/municipality';
import { HStack, VStack, Text, Pressable, Avatar } from '../../primitives';
import { useT } from '../../../lib/i18n';
import { PendingBadge } from './PendingBadge';

export interface ProposableListItemProps {
  name: string;
  imageURL?: string | null;
  subtitle?: string | null;
  status: ProposalStatus;
  /** Organizer (village/app admin): commits directly, approves/rejects, deletes. */
  canManage: boolean;
  /** The signed-in user is the proposer of this still-pending item. */
  isOwnPending: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  /** Proposer withdraws their own pending item. */
  onWithdraw?: () => void;
  /** Organizer deletes a (usually approved) item. */
  onDelete?: () => void;
}

function Action({ testID, label, tone, onPress }: { testID: string; label: string; tone?: string; onPress: () => void }) {
  return (
    <Pressable testID={testID} onPress={onPress}>
      <Text className={tone ?? 'text-secondary'}>{label}</Text>
    </Pressable>
  );
}

export function ProposableListItem({
  name,
  imageURL,
  subtitle,
  status,
  canManage,
  isOwnPending,
  onApprove,
  onReject,
  onEdit,
  onWithdraw,
  onDelete,
}: ProposableListItemProps) {
  const { t } = useT();
  const isPending = status === 'pending';

  return (
    <View className="py-3 border-b border-subtle">
      <HStack gap={2} align="center">
        <Avatar uri={imageURL} size={40} initials={name.slice(0, 1)} />
        <VStack gap={1} className="flex-1">
          <Text>{name}</Text>
          {subtitle ? (
            <Text className="text-muted text-sm">{subtitle}</Text>
          ) : null}
          {isPending ? <PendingBadge /> : null}
        </VStack>
        <HStack gap={2} align="center">
          {canManage && isPending && onApprove ? (
            <Action testID="action-approve" label={t('common.approve')} tone="text-green-700" onPress={onApprove} />
          ) : null}
          {canManage && isPending && onReject ? (
            <Action testID="action-reject" label={t('common.reject')} tone="text-red-600" onPress={onReject} />
          ) : null}
          {((canManage && !isPending) || isOwnPending) && onEdit ? (
            <Action testID="action-edit" label={t('common.edit')} onPress={onEdit} />
          ) : null}
          {!canManage && isOwnPending && onWithdraw ? (
            <Action testID="action-withdraw" label={t('village.proposals.withdraw')} tone="text-red-600" onPress={onWithdraw} />
          ) : null}
          {canManage && !isPending && onDelete ? (
            <Action testID="action-delete" label={t('common.delete')} tone="text-red-600" onPress={onDelete} />
          ) : null}
        </HStack>
      </HStack>
    </View>
  );
}
