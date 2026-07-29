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
import { Avatar } from '../primitives/Avatar';
import { DetailSectionHeading } from './DetailSectionHeading';
import { useAuth } from '../../lib/auth/useAuth';
import { useRegisterGate } from '../../lib/auth/RegisterGateContext';
import { useT } from '../../lib/i18n';
import {
  addComment,
  deleteComment,
  getComments,
  getReplies,
} from '@cultuvilla/shared/services/commentsService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';
import { buildDisplayName } from '@cultuvilla/shared/models/person/PersonDataModel';
import { formatCompactRelativeTime } from '@cultuvilla/shared/utils';
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

/** Resolved author metadata, keyed by uid (name + optional profile photo). */
type CommentAuthor = { name: string; photoURL: string | null };

function initialsOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '+';
}

/**
 * Instagram-style composer affordance: no button at rest, a send arrow inside
 * the field as soon as there is something to send.
 */
function SendAdornment({
  visible,
  sending,
  onPress,
  label,
  testID,
}: {
  visible: boolean;
  sending: boolean;
  onPress: () => void;
  label: string;
  testID?: string;
}) {
  if (!visible) return null;
  if (sending) return <ActivityIndicator size="small" />;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={testID}>
      <Ionicons name="arrow-up-circle" size={iconSizes.lg} color={colors.light.bg.accent} />
    </Pressable>
  );
}

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
  const [authors, setAuthors] = useState<Map<string, CommentAuthor>>(new Map());
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [repliesByParent, setRepliesByParent] = useState<Map<string, CommentDoc[]>>(new Map());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [sendingReply, setSendingReply] = useState(false);

  const me = user ? authors.get(user.uid) : undefined;

  useEffect(() => {
    setLoading(true);
    void (async () => {
      setComments(await getComments(entityKind, entityId));
      setLoading(false);
    })();
  }, [entityKind, entityId]);

  // Resolve author name + photo once per uid (avoid an N+1 refetch per comment).
  useEffect(() => {
    const replyAuthorIds = [...repliesByParent.values()].flat().map((r) => r.authorUserId);
    // The signed-in user is resolved too — the composer shows their avatar.
    const unresolved = [
      ...new Set([...comments.map((c) => c.authorUserId), ...replyAuthorIds, ...(user ? [user.uid] : [])]),
    ].filter((uid) => !authors.has(uid));
    if (unresolved.length === 0) return;
    void (async () => {
      const entries = await Promise.all(
        unresolved.map(async (uid) => {
          const [person, profile] = await Promise.all([
            getPersonByUserId(uid),
            getUserProfile(uid),
          ]);
          const author: CommentAuthor = {
            name: person
              ? buildDisplayName(person)
              : profile?.displayName || t('comments.anonymousAuthor'),
            photoURL: person?.photoURL ?? null,
          };
          return [uid, author] as const;
        }),
      );
      setAuthors((prev) => {
        const next = new Map(prev);
        for (const [uid, author] of entries) next.set(uid, author);
        return next;
      });
    })();
    // authors is read but intentionally excluded — it's the accumulator this
    // effect writes to; including it would re-run on every resolution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, repliesByParent, user, t]);

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
      const parentId = [...repliesByParent.entries()].find(([, replies]) =>
        replies.some((r) => r.id === commentId),
      )?.[0];
      setComments((prev) =>
        prev
          .filter((c) => c.id !== commentId)
          .map((c) => (c.id === parentId ? { ...c, replyCount: c.replyCount - 1 } : c)),
      );
      if (parentId) {
        setRepliesByParent((prev) => {
          const next = new Map(prev);
          next.set(parentId, (prev.get(parentId) ?? []).filter((r) => r.id !== commentId));
          return next;
        });
      }
      void deleteComment(commentId);
    });
  };

  const onToggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
        return next;
      }
      next.add(commentId);
      if (!repliesByParent.has(commentId)) {
        setLoadingReplies((p) => new Set(p).add(commentId));
        void (async () => {
          const replies = await getReplies(entityKind, entityId, commentId);
          setRepliesByParent((prev2) => new Map(prev2).set(commentId, replies));
          setLoadingReplies((p) => {
            const n = new Set(p);
            n.delete(commentId);
            return n;
          });
        })();
      }
      return next;
    });
  };

  const onSendReply = (parentCommentId: string) => {
    if (!user) return;
    const trimmed = replyBody.trim();
    if (!trimmed || sendingReply) return;
    setSendingReply(true);
    void (async () => {
      try {
        const id = await addComment({
          entityKind, entityId, municipalityId, authorUserId: user.uid, body: trimmed, parentCommentId,
        });
        const newReply: CommentDoc = {
          id, entityKind, entityId, municipalityId, authorUserId: user.uid, body: trimmed,
          createdAt: new Date(), parentCommentId, replyCount: 0,
        };
        setRepliesByParent((prev) => {
          const next = new Map(prev);
          next.set(parentCommentId, [...(next.get(parentCommentId) ?? []), newReply]);
          return next;
        });
        setComments((prev) =>
          prev.map((c) => (c.id === parentCommentId ? { ...c, replyCount: c.replyCount + 1 } : c)),
        );
        setExpandedReplies((prev) => new Set(prev).add(parentCommentId));
        setReplyingTo(null);
        setReplyBody('');
      } finally {
        setSendingReply(false);
      }
    })();
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
          {
            id, entityKind, entityId, municipalityId, authorUserId: user.uid, body: trimmed,
            createdAt: new Date(), parentCommentId: null, replyCount: 0,
          },
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
            const author = authors.get(comment.authorUserId);
            const name = author?.name ?? t('comments.anonymousAuthor');
            return (
              <VStack key={comment.id} gap={1}>
                <HStack gap={2} align="start" justify="between">
                  <Avatar uri={author?.photoURL ?? null} size={36} initials={initialsOf(name)} />
                  <VStack gap={1} className="flex-1">
                    {/* Instagram-style header: name with the age of the comment
                        beside it, the body on its own line underneath. */}
                    <HStack gap={2} align="center">
                      <Text className="font-bold flex-shrink" numberOfLines={1}>
                        {name}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {formatCompactRelativeTime(comment.createdAt)}
                      </Text>
                    </HStack>
                    <Text>{comment.body}</Text>
                    <HStack gap={4}>
                      {comment.replyCount > 0 ? (
                        <Pressable onPress={() => onToggleReplies(comment.id)}>
                          <Text variant="caption" tone="muted">
                            {expandedReplies.has(comment.id)
                              ? t('comments.hideReplies')
                              : t('comments.viewReplies', { count: comment.replyCount })}
                          </Text>
                        </Pressable>
                      ) : null}
                      {user ? (
                        <Pressable onPress={() => setReplyingTo(comment.id)}>
                          <Text variant="caption" tone="muted">{t('comments.reply')}</Text>
                        </Pressable>
                      ) : null}
                    </HStack>
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

                {replyingTo === comment.id ? (
                  <View className="pl-10">
                    <Input
                      value={replyBody}
                      onChangeText={setReplyBody}
                      placeholder={t('comments.replyPlaceholder')}
                      accessibilityLabel={t('comments.replyPlaceholder')}
                      autoFocus
                      pill
                      onSubmitEditing={() => onSendReply(comment.id)}
                      returnKeyType="send"
                      rightAdornment={
                        <SendAdornment
                          visible={replyBody.trim().length > 0}
                          sending={sendingReply}
                          onPress={() => onSendReply(comment.id)}
                          label={t('comments.send')}
                        />
                      }
                    />
                  </View>
                ) : null}

                {expandedReplies.has(comment.id) ? (
                  loadingReplies.has(comment.id) ? (
                    <View className="pl-10 py-2">
                      <ActivityIndicator size="small" />
                    </View>
                  ) : (
                    <VStack gap={2} className="pl-10">
                      {(repliesByParent.get(comment.id) ?? []).map((reply) => {
                        const replyAuthor = authors.get(reply.authorUserId);
                        const replyName = replyAuthor?.name ?? t('comments.anonymousAuthor');
                        const canDeleteReply = reply.authorUserId === user?.uid || canModerate;
                        return (
                          <HStack key={reply.id} gap={2} align="start" justify="between">
                            <Avatar uri={replyAuthor?.photoURL ?? null} size={28} initials={initialsOf(replyName)} />
                            <VStack gap={1} className="flex-1">
                              <HStack gap={2} align="center">
                                <Text className="font-bold flex-shrink" numberOfLines={1}>
                                  {replyName}
                                </Text>
                                <Text variant="caption" tone="muted">
                                  {formatCompactRelativeTime(reply.createdAt)}
                                </Text>
                              </HStack>
                              <Text>{reply.body}</Text>
                            </VStack>
                            {canDeleteReply ? (
                              <Pressable
                                onPress={() => onDelete(reply.id)}
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
                  )
                ) : null}
              </VStack>
            );
          })}
        </VStack>
      )}
      {user ? (
        <HStack gap={2} align="center">
          <Avatar
            uri={me?.photoURL ?? null}
            size={32}
            initials={initialsOf(me?.name ?? t('comments.anonymousAuthor'))}
          />
          <View className="flex-1">
            <Input
              value={body}
              onChangeText={setBody}
              placeholder={t('comments.placeholder')}
              accessibilityLabel={t('comments.placeholder')}
              testID="comment-input"
              pill
              onSubmitEditing={onSend}
              returnKeyType="send"
              rightAdornment={
                <SendAdornment
                  visible={body.trim().length > 0}
                  sending={sending}
                  onPress={onSend}
                  label={t('comments.send')}
                  testID="comment-send"
                />
              }
            />
          </View>
        </HStack>
      ) : (
        <Button variant="secondary" onPress={() => gate.requireAuth(pathname, t('guest.comment'))}>
          {t('comments.signInToComment')}
        </Button>
      )}
    </VStack>
  );
}
