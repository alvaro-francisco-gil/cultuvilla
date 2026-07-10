import { useMemo, useState } from 'react';
import {
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@cultuvilla/shared/design-system';
import { Text, VStack } from '../primitives';
import { useT } from '../../lib/i18n';
import {
  activeMentionQuery,
  adjustMentions,
  deleteMentionAt,
  insertMention,
  mentionRuns,
  type MentionCandidate,
} from '../../lib/mentionText';
import type { NewsMention, MentionEntityType } from '@cultuvilla/shared/models/news/NewsPostDataModel';

const ACCENT = colors.light.fg.accent;

const ENTITY_ICON: Record<MentionEntityType, keyof typeof Ionicons.glyphMap> = {
  organization: 'people-outline',
  user: 'person-outline',
  event: 'calendar-outline',
  place: 'location-outline',
  village: 'home-outline',
  news: 'newspaper-outline',
};

interface MentionTextInputProps {
  value: string;
  mentions: NewsMention[];
  onChange: (text: string, mentions: NewsMention[]) => void;
  candidates: MentionCandidate[];
  placeholder?: string;
  /** Fired when this field gains focus — lets the editor track the active block. */
  onFocus?: () => void;
  /** Reports the caret position so the editor can split here on image insert. */
  onSelectionChange?: (caret: number) => void;
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
  onFocus,
  onSelectionChange,
}: MentionTextInputProps) {
  const { t } = useT();
  // Track the caret only to detect an in-progress `@query`. We deliberately do
  // NOT control the native `selection` prop: on Android a controlled selection
  // forces the field into NO_SUGGESTIONS mode, which drops the keyboard's
  // suggestion strip (the "keyboard got smaller" bug). After a mention insert we
  // let the caret fall to the end of the new value, which is the common case.
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [scrollY, setScrollY] = useState(0);
  const runs = useMemo(() => mentionRuns(value, mentions), [value, mentions]);

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

  function handleKeyPress(e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    const key = e.nativeEvent.key;
    if (key !== 'Backspace' && key !== 'Delete') return;
    if (selection.start !== selection.end) return; // a range delete flows through adjustMentions
    const res = deleteMentionAt(value, mentions, selection.start, key === 'Backspace' ? 'backward' : 'forward');
    if (!res) return;
    // preventDefault fires on RN-Web (our primary target); it stops the textarea
    // from also eating one character. Native has no equivalent — see the plan's
    // accepted-risks note.
    (e as unknown as { preventDefault?: () => void }).preventDefault?.();
    onChange(res.text, res.mentions);
    setSelection({ start: res.cursor, end: res.cursor });
  }

  function pick(candidate: MentionCandidate) {
    if (!active) return;
    const res = insertMention(value, mentions, active, candidate);
    onChange(res.text, res.mentions);
    // Predict the caret so the suggestion list closes immediately; the native
    // onSelectionChange will confirm it on the next frame.
    setSelection({ start: res.cursor, end: res.cursor });
  }

  return (
    <VStack gap={1}>
      <View className="border rounded-md px-3 py-2 bg-surface border-subtle" style={{ minHeight: 96 }}>
        <View style={{ position: 'relative', flex: 1 }}>
          <Text
            pointerEvents="none"
            className="text-body"
            style={[StyleSheet.absoluteFill, { transform: [{ translateY: -scrollY }] }]}
          >
            {runs.map((run, i) =>
              run.mention ? (
                <Text key={i} className="text-accent underline">
                  {run.text}
                </Text>
              ) : (
                <Text key={i} className="text-primary">
                  {run.text}
                </Text>
              ),
            )}
          </Text>
          <TextInput
            value={value}
            onChangeText={handleChangeText}
            onKeyPress={handleKeyPress}
            onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
            multiline
            placeholder={placeholder}
            placeholderTextColor={colors.light.fg.muted}
            accessibilityLabel={placeholder}
            className="text-body"
            textAlignVertical="top"
            style={{ minHeight: 96, color: 'transparent' }}
            cursorColor={ACCENT}
            selectionColor={ACCENT}
            onFocus={onFocus}
            onSelectionChange={(e) => {
              const sel = e.nativeEvent.selection;
              setSelection(sel);
              onSelectionChange?.(sel.start);
            }}
          />
        </View>
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
