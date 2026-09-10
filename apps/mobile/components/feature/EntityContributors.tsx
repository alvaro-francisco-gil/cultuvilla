import { View } from 'react-native';
import { router } from 'expo-router';
import { LiveOwnerChip } from './LiveOwnerChip';
import { DetailSectionHeading } from './DetailSectionHeading';
import { VStack } from '../primitives/VStack';
import { Text } from '../primitives/Text';
import { ownerRoute } from '../../lib/entities/ownerRoute';

/**
 * Digitization credit ("Digitalizado por") — the groups and villagers who
 * brought something into the app.
 *
 * `section` is the detail-screen block under its own heading. `inline` is a
 * small muted byline for the places a thing is credited many times over on
 * one screen — each meaning of a vocabulary word — where a heading per item
 * would drown the content it credits.
 */
export function EntityContributors({
  userIds,
  orgIds,
  label,
  variant = 'section',
}: {
  userIds: string[];
  orgIds: string[];
  label: string;
  variant?: 'section' | 'inline';
}) {
  if (userIds.length === 0 && orgIds.length === 0) return null;

  const inline = variant === 'inline';
  const chipSize = inline ? 20 : 28;
  const chips = (
    <View className="flex-row flex-wrap items-center" style={{ gap: inline ? 8 : 12 }}>
      {orgIds.map((id) => (
        <LiveOwnerChip
          key={id}
          ownerId={id}
          ownerType="organization"
          size={chipSize}
          tone="muted"
          onPress={() => router.push(ownerRoute('organization', id) as never)}
        />
      ))}
      {userIds.map((id) => (
        <LiveOwnerChip
          key={id}
          ownerId={id}
          ownerType="user"
          size={chipSize}
          tone="muted"
          onPress={() => router.push(ownerRoute('user', id) as never)}
        />
      ))}
    </View>
  );

  if (inline) {
    return (
      <VStack gap={1}>
        <Text tone="muted" variant="bodySm">
          {label}
        </Text>
        {chips}
      </VStack>
    );
  }

  return (
    <VStack gap={2}>
      <DetailSectionHeading>{label}</DetailSectionHeading>
      {chips}
    </VStack>
  );
}
