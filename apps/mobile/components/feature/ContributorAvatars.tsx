import { View } from 'react-native';
import { Text } from '../primitives/Text';
import { LiveAvatar } from './LiveAvatar';

const MAX_FACES = 3;
const SIZE = 24;
const OVERLAP = 8;

/**
 * The villagers credited on a list row, as a small overlapping stack of faces —
 * the at-a-glance cousin of `EntityContributors`, which names them in full on
 * the detail screen. Each face is a live read, deduped per user, so a list that
 * credits the same few villagers over and over costs one listener each.
 */
export function ContributorAvatars({ userIds }: { userIds: string[] }) {
  if (userIds.length === 0) return null;
  const shown = userIds.slice(0, MAX_FACES);
  const hidden = userIds.length - shown.length;
  return (
    <View className="flex-row items-center">
      {shown.map((id, index) => (
        <View
          key={id}
          className="rounded-full bg-surface"
          style={{ marginLeft: index === 0 ? 0 : -OVERLAP, padding: 1.5 }}
        >
          <LiveAvatar ownerId={id} ownerType="user" size={SIZE} />
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
