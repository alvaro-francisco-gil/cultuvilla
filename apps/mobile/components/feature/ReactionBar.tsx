import { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { HStack } from '../primitives/HStack';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { useAuth } from '../../lib/auth/useAuth';
import { useRegisterGate } from '../../lib/auth/RegisterGateContext';
import { useT } from '../../lib/i18n';
import { getMyReaction, reactToEntity, removeReaction } from '@cultuvilla/shared/services/commentsService';
import { colors, iconSizes } from '@cultuvilla/shared/design-system';
import type { EntityKind, ReactionKind } from '@cultuvilla/shared/models';

export type ReactionBarProps = {
  entityKind: EntityKind;
  entityId: string;
  municipalityId: string;
  initialCounts: { like: number; heart: number };
};

const REACTION_ICON: Record<ReactionKind, { filled: keyof typeof Ionicons.glyphMap; outline: keyof typeof Ionicons.glyphMap }> = {
  like: { filled: 'thumbs-up', outline: 'thumbs-up-outline' },
  heart: { filled: 'heart', outline: 'heart-outline' },
};

export function ReactionBar({ entityKind, entityId, municipalityId, initialCounts }: ReactionBarProps) {
  const { user } = useAuth();
  const gate = useRegisterGate();
  const { t } = useT();
  const pathname = usePathname();
  const [counts, setCounts] = useState(initialCounts);
  const [myReaction, setMyReaction] = useState<ReactionKind | null>(null);

  useEffect(() => {
    if (!user) {
      setMyReaction(null);
      return;
    }
    void (async () => {
      setMyReaction(await getMyReaction(entityKind, entityId, user.uid));
    })();
  }, [entityKind, entityId, user]);

  const onPress = (kind: ReactionKind) => {
    if (!user) {
      gate.requireAuth(pathname, t('guest.comment'));
      return;
    }

    const wasReacting = myReaction;
    if (wasReacting === kind) {
      setMyReaction(null);
      setCounts((prev) => ({ ...prev, [kind]: Math.max(0, prev[kind] - 1) }));
      void removeReaction(entityKind, entityId, user.uid);
      return;
    }

    setMyReaction(kind);
    setCounts((prev) => {
      const next = { ...prev, [kind]: prev[kind] + 1 };
      if (wasReacting) next[wasReacting] = Math.max(0, next[wasReacting] - 1);
      return next;
    });
    void reactToEntity({ entityKind, entityId, municipalityId, userId: user.uid, kind });
  };

  const labels: Record<ReactionKind, string> = {
    like: t('comments.reactionLike'),
    heart: t('comments.reactionHeart'),
  };

  return (
    <HStack gap={2}>
      {(['like', 'heart'] as ReactionKind[]).map((kind) => {
        const active = myReaction === kind;
        const icon = active ? REACTION_ICON[kind].filled : REACTION_ICON[kind].outline;
        return (
          <Pressable
            key={kind}
            onPress={() => onPress(kind)}
            accessibilityRole="button"
            accessibilityLabel={labels[kind]}
            accessibilityState={{ selected: active }}
            className={`flex-row items-center gap-1 px-3 py-1.5 rounded-full border ${
              active ? 'bg-accent border-accent' : 'border-subtle bg-surface'
            }`}
          >
            <Ionicons
              name={icon}
              size={iconSizes.sm}
              color={active ? colors.light.fg['on-accent'] : colors.light.fg.primary}
            />
            <Text tone={active ? 'onAccent' : 'primary'} variant="caption">
              {counts[kind]}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
}
