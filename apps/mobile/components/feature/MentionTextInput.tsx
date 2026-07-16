import { useMemo, useState } from 'react';
import {
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputKeyPressEventData,
  TextStyle,
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
  type MentionCandidate,
} from '../../lib/mentionText';
import { detectPastedUrl, applyCustomTextLink, buildLinkRuns, isSafeHttpUrl, addLinkSpan } from '../../lib/linkText';
import { toggleBold, isRangeBold } from '../../lib/boldText';
import { LinkSheet } from './LinkSheet';
import { LinkUrlSheet } from './LinkUrlSheet';
import type { NewsMention, NewsLink, NewsBold, MentionEntityType } from '@cultuvilla/shared/models/news/NewsPostDataModel';

const ACCENT = colors.light.fg.accent;

// Appended to the styled overlay so its last line still has height when the
// text ends in a newline — keeps the overlay aligned with the input layer.
const TRAILING_ANCHOR = String.fromCodePoint(0x200b); // zero-width space

const ENTITY_ICON: Record<MentionEntityType, keyof typeof Ionicons.glyphMap> = {
  organization: 'people-outline',
  event: 'calendar-outline',
  place: 'location-outline',
  barrio: 'map-outline',
  village: 'home-outline',
  news: 'newspaper-outline',
  festivalPoster: 'image-outline',
};

interface MentionTextInputProps {
  value: string;
  mentions: NewsMention[];
  links: NewsLink[];
  bolds: NewsBold[];
  onChange: (text: string, mentions: NewsMention[], links: NewsLink[], bolds: NewsBold[]) => void;
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
  links,
  bolds,
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
  const [pendingUrl, setPendingUrl] = useState<{ url: string; offset: number; length: number } | null>(
    null,
  );
  // A non-empty range awaiting a URL (the toolbar's link button opens LinkUrlSheet).
  const [linkRange, setLinkRange] = useState<{ start: number; end: number } | null>(null);
  const runs = useMemo(() => buildLinkRuns(value, mentions, links, bolds), [value, mentions, links, bolds]);

  const hasSelection = selection.start !== selection.end;
  const active = !hasSelection ? activeMentionQuery(value, selection.start, mentions) : null;

  const suggestions = useMemo(() => {
    if (!active) return [];
    const q = active.query.trim().toLowerCase();
    const matches = q
      ? candidates.filter((c) => c.label.toLowerCase().includes(q))
      : candidates;
    return matches.slice(0, 8);
  }, [active, candidates]);

  function handleChangeText(next: string) {
    const nextMentions = adjustMentions(value, next, mentions);
    const nextLinks = adjustMentions(value, next, links);
    const nextBolds = adjustMentions(value, next, bolds);
    onChange(next, nextMentions, nextLinks, nextBolds);
    const detected = detectPastedUrl(value, next);
    if (detected && isSafeHttpUrl(detected.url)) setPendingUrl(detected);
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
    onChange(res.text, res.mentions, adjustMentions(value, res.text, links), adjustMentions(value, res.text, bolds));
    moveCaret(res.cursor);
  }

  function pick(candidate: MentionCandidate) {
    if (!active) return;
    const res = insertMention(value, mentions, active, candidate);
    onChange(res.text, res.mentions, adjustMentions(value, res.text, links), adjustMentions(value, res.text, bolds));
    moveCaret(res.cursor);
  }

  // Toolbar actions operate on the last known selection range. The value is
  // unchanged (bold is a style; a link records a span over existing text), so
  // even if pressing the button blurred the field, the offsets stay valid.
  function applyBoldToSelection() {
    onChange(value, mentions, links, toggleBold(bolds, selection.start, selection.end));
  }

  function openLinkForSelection() {
    setLinkRange({ start: selection.start, end: selection.end });
  }

  // A programmatic edit (mention insert / atomic delete) moves the caret without
  // the native field firing onSelectionChange — on web a scripted value+selection
  // change doesn't reliably re-emit it. Report the new caret to the parent
  // ourselves so consumers tracking it (e.g. BlockEditor's image-insert split
  // point) don't act on a stale offset. Predicting it also closes the suggestion
  // list immediately; the native onSelectionChange confirms it on the next frame.
  function moveCaret(cursor: number) {
    setSelection({ start: cursor, end: cursor });
    onSelectionChange?.(cursor);
  }

  return (
    <VStack gap={1}>
      <View className="border rounded-md px-3 py-2 bg-surface border-subtle">
        {/* Auto-grow: the styled overlay sits in normal flow and drives the
            box height, so it expands line-by-line as you type instead of
            scrolling inside a fixed window. The transparent TextInput is
            layered on top (absolute-fill) to own the caret and editing; since
            it renders the same text it wraps to the same height as the overlay.
            The trailing zero-width space keeps the overlay's final line present
            when the text ends in a newline, so the two layers stay aligned. */}
        <View style={{ position: 'relative', minHeight: 80 }}>
          <Text pointerEvents="none" className="text-body">
            {runs.map((run, i) => {
              const linked = run.mention || run.link || run.autoUrl;
              const base = linked ? 'text-accent underline' : 'text-primary';
              return (
                <Text key={i} className={run.bold ? `${base} font-bold` : base}>
                  {run.text}
                </Text>
              );
            })}
            {TRAILING_ANCHOR}
          </Text>
          <TextInput
            value={value}
            onChangeText={handleChangeText}
            onKeyPress={handleKeyPress}
            multiline
            placeholder={placeholder}
            placeholderTextColor={colors.light.fg.muted}
            accessibilityLabel={placeholder}
            className="text-body"
            textAlignVertical="top"
            // The text layer is transparent (glyphs come from the overlay Text
            // above). On web the CSS caret-color inherits from `color`, so a
            // transparent color hides the caret too — force it back to the accent.
            // Native draws the caret from `cursorColor`, independent of text color.
            style={[
              StyleSheet.absoluteFill,
              { color: 'transparent', padding: 0 },
              // caretColor is a web-only CSS property not modelled by RN's TextStyle.
              Platform.OS === 'web' ? ({ caretColor: ACCENT } as unknown as TextStyle) : null,
            ]}
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
      {hasSelection ? (
        <View className="flex-row items-center gap-1 self-start rounded-md border border-subtle bg-surface-elevated p-1">
          <Pressable
            onPress={applyBoldToSelection}
            accessibilityRole="button"
            accessibilityLabel={t('news.compose.format.bold')}
            accessibilityState={{ selected: isRangeBold(bolds, selection.start, selection.end) }}
            hitSlop={4}
            className={`h-8 w-8 items-center justify-center rounded ${
              isRangeBold(bolds, selection.start, selection.end) ? 'bg-surface' : ''
            }`}
          >
            <Text className="text-accent font-bold">B</Text>
          </Pressable>
          <Pressable
            onPress={openLinkForSelection}
            accessibilityRole="button"
            accessibilityLabel={t('news.compose.format.link')}
            hitSlop={4}
            className="h-8 w-8 items-center justify-center rounded"
          >
            <Ionicons name="link" size={18} color={ACCENT} />
          </Pressable>
        </View>
      ) : null}
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
      <LinkSheet
        url={pendingUrl?.url ?? null}
        onDismiss={() => setPendingUrl(null)}
        onSave={(displayText) => {
          if (pendingUrl && displayText) {
            const res = applyCustomTextLink(value, mentions, links, pendingUrl, displayText);
            // The display text replaces the pasted URL, so bold spans shift too.
            onChange(res.text, res.mentions, res.links, adjustMentions(value, res.text, bolds));
          }
          setPendingUrl(null);
        }}
      />
      <LinkUrlSheet
        displayText={linkRange ? value.slice(linkRange.start, linkRange.end) : null}
        onDismiss={() => setLinkRange(null)}
        onSave={(url) => {
          if (linkRange) {
            onChange(value, mentions, addLinkSpan(links, linkRange.start, linkRange.end, url), bolds);
          }
          setLinkRange(null);
        }}
      />
    </VStack>
  );
}
