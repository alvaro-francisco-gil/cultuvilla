import { View } from 'react-native';
import { LiveOwnerChip } from './LiveOwnerChip';
import { DetailSectionHeading } from './DetailSectionHeading';
import { VStack } from '../primitives/VStack';

export function EntityContributors({
  userIds,
  orgIds,
  label,
}: {
  userIds: string[];
  orgIds: string[];
  label: string;
}) {
  if (userIds.length === 0 && orgIds.length === 0) return null;

  return (
    <VStack gap={2}>
      <DetailSectionHeading>{label}</DetailSectionHeading>
      <View className="flex-row flex-wrap items-center" style={{ gap: 12 }}>
        {orgIds.map((id) => (
          <LiveOwnerChip key={id} ownerId={id} ownerType="organization" size={28} tone="muted" />
        ))}
        {userIds.map((id) => (
          <LiveOwnerChip key={id} ownerId={id} ownerType="user" size={28} tone="muted" />
        ))}
      </View>
    </VStack>
  );
}
