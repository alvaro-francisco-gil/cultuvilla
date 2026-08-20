import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Screen } from '../../components/primitives/Screen';
import { Card } from '../../components/primitives/Card';
import { Pressable } from '../../components/primitives/Pressable';
import { Text } from '../../components/primitives/Text';
import { VStack } from '../../components/primitives/VStack';
import { HStack } from '../../components/primitives/HStack';
import { Avatar } from '../../components/primitives/Avatar';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { getBlockedUserIds, unblockUser } from '@cultuvilla/shared/services/blockedUserService';
import { resolveCommentAuthor, type CommentAuthor } from '../../lib/comments/commentAuthors';

type BlockedRow = { uid: string; author: CommentAuthor };

/**
 * The unblock half of the block feature. A block list you cannot undo is not a
 * block list — both stores look for the reversal path as much as the block.
 */
export default function BlockedUsersScreen() {
  const { user } = useAuth();
  const { t } = useT();
  const [rows, setRows] = useState<BlockedRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    const labels = { deleted: t('settings.deletedUser'), fallback: t('comments.anonymousAuthor') };
    const ids = await getBlockedUserIds(user.uid);
    setRows(
      await Promise.all(
        ids.map(async (uid) => ({ uid, author: await resolveCommentAuthor(uid, labels) })),
      ),
    );
    setLoading(false);
  }, [user, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onUnblock = (uid: string) => {
    if (!user) return;
    setRows((prev) => prev.filter((r) => r.uid !== uid));
    void unblockUser(user.uid, uid);
  };

  return (
    <Screen padded={false} scroll>
      <ScreenHeader title={t('settings.blocked.title')} />
      <VStack gap={3} className="p-4">
        <Text variant="caption" tone="muted">
          {t('settings.blocked.hint')}
        </Text>
        {loading ? (
          <View className="items-center py-6">
            <ActivityIndicator />
          </View>
        ) : rows.length === 0 ? (
          <Text tone="muted">{t('settings.blocked.empty')}</Text>
        ) : (
          <Card variant="flat" className="p-0">
            {rows.map((row, i) => (
              <HStack
                key={row.uid}
                gap={3}
                align="center"
                justify="between"
                className={`px-4 py-3 ${i < rows.length - 1 ? 'border-b border-subtle' : ''}`}
              >
                <HStack gap={3} align="center" className="flex-1">
                  <Avatar
                    uri={row.author.photoURL ?? null}
                    size={32}
                    initials={row.author.name?.trim().charAt(0).toUpperCase() || '+'}
                  />
                  <Text numberOfLines={1} className="flex-1">
                    {row.author.name}
                  </Text>
                </HStack>
                <Pressable
                  onPress={() => onUnblock(row.uid)}
                  accessibilityRole="button"
                  testID={`unblock-${row.uid}`}
                >
                  <Text tone="danger">{t('settings.blocked.unblock')}</Text>
                </Pressable>
              </HStack>
            ))}
          </Card>
        )}
      </VStack>
    </Screen>
  );
}
