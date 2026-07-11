import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { Text } from '../primitives/Text';
import { Pressable } from '../primitives/Pressable';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { DetailSectionHeading } from './DetailSectionHeading';
import { useAuth } from '../../lib/auth/useAuth';
import { useRegisterGate } from '../../lib/auth/RegisterGateContext';
import { useT } from '../../lib/i18n';
import { addComment, deleteComment, getComments } from '@cultuvilla/shared/services/commentsService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { buildDisplayName } from '@cultuvilla/shared/models/person/PersonDataModel';
import { formatRelativeTime } from '@cultuvilla/shared/utils';
import { iconSizes, colors } from '@cultuvilla/shared/design-system';
import type { CommentData, EntityKind } from '@cultuvilla/shared/models';

export type EntityCommentsProps = {
  entityKind: EntityKind;
  entityId: string;
  municipalityId: string;
  /** true if the current user administers this entity's village (village-admin/app-admin) */
  canModerate?: boolean;
};

type CommentDoc = CommentData & { id: string };

export function EntityComments({
  entityKind,
  entityId,
  municipalityId,
  canModerate = false,
}: EntityCommentsProps) {
  const { user } = useAuth();
  const gate = useRegisterGate();
  const { t } = useT();
  const pathname = usePathname();
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorNames, setAuthorNames] = useState<Map<string, string>>(new Map());
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setLoading(true);
    void (async () => {
      setComments(await getComments(entityKind, entityId));
      setLoading(false);
    })();
  }, [entityKind, entityId]);

  // Resolve author display names once per uid (avoid an N+1 refetch per comment).
  useEffect(() => {
    const unresolved = [...new Set(comments.map((c) => c.authorUserId))].filter(
      (uid) => !authorNames.has(uid),
    );
    if (unresolved.length === 0) return;
    void (async () => {
      const entries = await Promise.all(
        unresolved.map(async (uid) => {
          const person = await getPersonByUserId(uid);
          return [uid, person ? buildDisplayName(person) : t('comments.anonymousAuthor')] as const;
        }),
      );
      setAuthorNames((prev) => {
        const next = new Map(prev);
        for (const [uid, name] of entries) next.set(uid, name);
        return next;
      });
    })();
    // authorNames is read but intentionally excluded — it's the accumulator
    // this effect writes to; including it would re-run on every resolution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, t]);

  const runDeleteConfirm = (onConfirm: () => void) => {
    // Alert.alert is a no-op on RN-Web, so branch to window.confirm there.
    if (Platform.OS === 'web') {
      if (window.confirm(t('comments.deleteConfirmMessage'))) onConfirm();
      return;
    }
    Alert.alert(t('comments.deleteConfirmTitle'), t('comments.deleteConfirmMessage'), [
      { text: t('comments.deleteConfirmCancel'), style: 'cancel' },
      { text: t('comments.deleteConfirmConfirm'), style: 'destructive', onPress: onConfirm },
    ]);
  };

  const onDelete = (commentId: string) => {
    runDeleteConfirm(() => {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      void deleteComment(commentId);
    });
  };

  const onSend = () => {
    if (!user) {
      gate.requireAuth(pathname, t('guest.comment'));
      return;
    }
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    void (async () => {
      try {
        const id = await addComment({
          entityKind,
          entityId,
          municipalityId,
          authorUserId: user.uid,
          body: trimmed,
        });
        setComments((prev) => [
          ...prev,
          { id, entityKind, entityId, municipalityId, authorUserId: user.uid, body: trimmed, createdAt: new Date() },
        ]);
        setBody('');
      } finally {
        setSending(false);
      }
    })();
  };

  return (
    <VStack gap={3}>
      <DetailSectionHeading>{t('comments.sectionTitle')}</DetailSectionHeading>
      {loading ? (
        <View className="items-center py-4">
          <ActivityIndicator />
        </View>
      ) : comments.length === 0 ? null : (
        <VStack gap={3}>
          {comments.map((comment) => {
            const canDelete = comment.authorUserId === user?.uid || canModerate;
            return (
              <HStack key={comment.id} gap={2} align="start" justify="between">
                <VStack gap={1} className="flex-1">
                  <HStack gap={2} align="center">
                    <Text className="font-bold">
                      {authorNames.get(comment.authorUserId) ?? t('comments.anonymousAuthor')}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {formatRelativeTime(comment.createdAt)}
                    </Text>
                  </HStack>
                  <Text>{comment.body}</Text>
                </VStack>
                {canDelete ? (
                  <Pressable
                    onPress={() => onDelete(comment.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('comments.delete')}
                    className="p-1"
                  >
                    <Ionicons name="trash-outline" size={iconSizes.sm} color={colors.light.fg.muted} />
                  </Pressable>
                ) : null}
              </HStack>
            );
          })}
        </VStack>
      )}
      {user ? (
        <HStack gap={2} align="center">
          <View className="flex-1">
            <Input
              value={body}
              onChangeText={setBody}
              placeholder={t('comments.placeholder')}
              accessibilityLabel={t('comments.placeholder')}
              testID="comment-input"
            />
          </View>
          <Button onPress={onSend} disabled={!body.trim()} loading={sending} testID="comment-send">
            {t('comments.send')}
          </Button>
        </HStack>
      ) : (
        <Button variant="secondary" onPress={() => gate.requireAuth(pathname, t('guest.comment'))}>
          {t('comments.signInToComment')}
        </Button>
      )}
    </VStack>
  );
}
