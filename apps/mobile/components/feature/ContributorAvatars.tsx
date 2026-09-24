import { View } from 'react-native';
import { Text } from '../primitives/Text';
import { LiveAvatar } from './LiveAvatar';

const MAX_FACES = 4;
const SIZE = 24;
const OVERLAP = 8;

/**
 * Everyone credited on a list row, as a small overlapping stack — groups first,
 * then villagers — the at-a-glance cousin of `EntityContributors`, which names
 * them in full on the detail screen. Groups lead because a word a peña or a
 * podcast brought in reads as theirs before it reads as any one person's. Each
 * face is a live read, deduped per owner, so a list that credits the same few
 * contributors over and over costs one listener each.
 */
export function ContributorAvatars({ userIds, orgIds }: { userIds: string[]; orgIds: string[] }) {
  const owners = [
    ...orgIds.map((id) => ({ id, type: 'organization' as const })),
    ...userIds.map((id) => ({ id, type: 'user' as const })),
  ];
  if (owners.length === 0) return null;
  const shown = owners.slice(0, MAX_FACES);
  const hidden = owners.length - shown.length;
  return (
    <View className="flex-row items-center">
      {shown.map((owner, index) => (
        <View
          key={`${owner.type}:${owner.id}`}
          className="rounded-full bg-surface"
          style={{ marginLeft: index === 0 ? 0 : -OVERLAP, padding: 1.5 }}
        >
          <LiveAvatar ownerId={owner.id} ownerType={owner.type} size={SIZE} />
        </View>
      ))}
      {hidden > 0 ? (
        <Text variant="caption" tone="muted" style={{ marginLeft: 4 }}>
          {`+${String(hidden)}`}
        </Text>
      ) : null}
    </View>
  );
}
