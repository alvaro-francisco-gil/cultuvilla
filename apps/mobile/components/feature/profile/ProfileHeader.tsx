import { View } from 'react-native';
import { Avatar, HStack, Text, VStack } from '../../primitives';
import { buildDisplayName, buildShortName } from '@cultuvilla/shared/models/person';
import type { PersonData } from '@cultuvilla/shared/models/person';

export interface ProfileHeaderProps {
  person: (PersonData & { id: string }) | null;
  fallbackName: string;
  uploading?: boolean;
  onPressAvatar?: () => void;
}

export function ProfileHeader({
  person,
  fallbackName,
  uploading,
  onPressAvatar,
}: ProfileHeaderProps) {
  const displayName = person ? buildDisplayName(person) : fallbackName;
  const shortName = person ? buildShortName(person) : fallbackName;
  const initials = (shortName || fallbackName || '?').charAt(0).toUpperCase();

  return (
    <HStack gap={4} align="center" className="px-4 pt-4">
      <View>
        <Avatar
          uri={person?.photoURL ?? undefined}
          size={88}
          initials={initials}
          onPress={onPressAvatar}
        />
        {uploading ? (
          <View className="absolute inset-0 items-center justify-center bg-surface/60 rounded-full">
            <Text variant="caption" tone="muted">…</Text>
          </View>
        ) : null}
      </View>
      <VStack gap={1} className="flex-1">
        <Text variant="h2" className="font-bold">{displayName}</Text>
      </VStack>
    </HStack>
  );
}
