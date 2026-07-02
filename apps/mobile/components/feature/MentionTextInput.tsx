import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@cultuvilla/shared/design-system';
import { Text, VStack } from '../primitives';
import { useT } from '../../lib/i18n';
import {
  activeMentionQuery,
  adjustMentions,
  insertMention,
  type MentionCandidate,
} from '../../lib/mentionText';
import type { NewsMention, MentionEntityType } from '@cultuvilla/shared/models/news/NewsPostDataModel';

const ACCENT = colors.light.fg.accent;

const ENTITY_ICON: Record<MentionEntityType, keyof typeof Ionicons.glyphMap> = {
  organization: 'people-outline',
  user: 'person-outline',
  event: 'calendar-outline',
  place: 'location-outline',
};

interface MentionTextInputProps {
  value: string;
  mentions: NewsMention[];
  onChange: (text: string, mentions: NewsMention[]) => void;
  candidates: MentionCandidate[];
  placeholder?: string;
}

/**
 * A multiline text field with `@`-mention autocomplete. Mentions are stored as
 * ranges alongside the raw text (see {@link lib/mentionText}); the field itself
 * renders plain text — the styled, tappable rendering happens on the reader
 * ({@link RichText}). Suggestions render inline beneath the field (rather than a
 * floating overlay) so they never clip inside the editor's ScrollView.
 */
export function MentionTextInput({
  value,
  mentions,
  onChange,
  candidates,
  placeholder,
}: MentionTextInputProps) {
  const { t } = useT();
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  // After a programmatic edit (mention insert) we force the caret once, then
  // release control back to the native field so typing/selection feels normal.
  const [forcedSelection, setForcedSelection] = useState<{ start: number; end: number } | null>(null);

  const active =
    selection.start === selection.end
      ? activeMentionQuery(value, selection.start, mentions)
      : null;

  const suggestions = useMemo(() => {
    if (!active) return [];
    const q = active.query.trim().toLowerCase();
    const matches = q
      ? candidates.filter((c) => c.label.toLowerCase().includes(q))
      : candidates;
    return matches.slice(0, 8);
  }, [active, candidates]);

  function handleChangeText(next: string) {
    onChange(next, adjustMentions(value, next, mentions));
  }

  function pick(candidate: MentionCandidate) {
    if (!active) return;
    const res = insertMention(value, mentions, active, candidate);
    onChange(res.text, res.mentions);
    const caret = { start: res.cursor, end: res.cursor };
    setSelection(caret);
    setForcedSelection(caret);
  }

  return (
    <VStack gap={1}>
      <View className="border rounded-md px-3 py-2 bg-surface border-subtle">
        <TextInput
          value={value}
          onChangeText={handleChangeText}
          multiline
          placeholder={placeholder}
          accessibilityLabel={placeholder}
          className="text-primary text-body"
          textAlignVertical="top"
          style={{ minHeight: 96 }}
          selection={forcedSelection ?? undefined}
          onSelectionChange={(e) => {
            setSelection(e.nativeEvent.selection);
            // Release forced caret after the native field has applied it.
            if (forcedSelection) setForcedSelection(null);
          }}
        />
      </View>
      {active && suggestions.length > 0 ? (
        <VStack gap={1} className="rounded-md border border-subtle bg-surface-elevated p-1">
          {suggestions.map((c) => (
            <Pressable
              key={`${c.entityType}:${c.entityId}`}
              onPress={() => pick(c)}
              accessibilityRole="button"
              accessibilityLabel={c.label}
              className="flex-row items-center gap-2 rounded p-2"
            >
              <Ionicons name={ENTITY_ICON[c.entityType]} size={18} color={ACCENT} />
              <Text className="flex-1" numberOfLines={1}>
                {c.label}
              </Text>
              <Text variant="caption" tone="muted">
                {t(`news.compose.mentionType.${c.entityType}`)}
              </Text>
            </Pressable>
          ))}
        </VStack>
      ) : null}
    </VStack>
  );
}
