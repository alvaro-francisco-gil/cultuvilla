import { useRef, useState } from 'react';
import { Image, Text as RNText, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, iconSizes } from '@cultuvilla/shared/design-system';
import { HStack, Pressable, Text, VStack } from '../primitives';
import { useT } from '../../lib/i18n';
import { pickImageWithSize } from '../../lib/images';
import { MentionTextInput } from './MentionTextInput';
import { HEADING_PRESENTATION, type HeadingLevel } from '../../lib/newsHeading';
import { splitMentionsAtCaret, type MentionCandidate } from '../../lib/mentionText';
import type {
  NewsMention,
  NewsLink,
  NewsMark,
  NewsTextBlock,
} from '@cultuvilla/shared/models/news/NewsPostDataModel';

const ACCENT = colors.light.fg.accent;
const MUTED = colors.light.fg.muted;


/**
 * Editor-side block. Distinct from the persisted `NewsBlock`: it carries a
 * stable `id` for list keys, and image blocks hold either an already-uploaded
 * `storagePath` (edit mode) or a freshly-picked `blob` awaiting upload on submit.
 * The parent screen maps these to `NewsBlock`s at save time.
 */
export type EditorTextBlock = {
  id: string;
  type: 'text';
  text: string;
  mentions: NewsMention[];
  links: NewsLink[];
  marks: NewsMark[];
};
export type EditorImageBlock = {
  id: string;
  type: 'image';
  /** Set when the image is already in Storage (edit mode). */
  storagePath: string | null;
  /** Set for a freshly-picked image, uploaded on submit. */
  blob: Blob | null;
  /** Preview/display URI (download URL or local asset uri). */
  uri: string | null;
  width: number;
  height: number;
  caption: string;
  captionMentions: NewsMention[];
  captionLinks: NewsLink[];
  captionMarks: NewsMark[];
};
/** A section / subsection title: plain text, no mentions, links or marks. */
export type EditorHeadingBlock = {
  id: string;
  type: 'heading';
  text: string;
  level: HeadingLevel;
};
export type EditorBlock = EditorTextBlock | EditorImageBlock | EditorHeadingBlock;

const HEADING_LEVELS: HeadingLevel[] = ['section', 'subsection'];

// Cap to avoid unbounded arrays — the block editor's inline body images, not a
// gallery, so this is a UI-only product decision rather than a schema limit.
const MAX_IMAGE_BLOCKS = 25;

let blockSeq = 0;
export function newBlockId(): string {
  blockSeq += 1;
  return `b${blockSeq}-${Date.now()}`;
}

export function emptyTextBlock(): EditorTextBlock {
  return { id: newBlockId(), type: 'text', text: '', mentions: [], links: [], marks: [] };
}

/** Stored text block → editor block. A heading is persisted as a styled text block. */
export function newsTextToEditorBlock(b: NewsTextBlock): EditorTextBlock | EditorHeadingBlock {
  if (b.style !== 'paragraph') return { id: newBlockId(), type: 'heading', text: b.text, level: b.style };
  return { id: newBlockId(), type: 'text', text: b.text, mentions: b.mentions, links: b.links, marks: b.marks };
}

/** Editor text or heading block → stored text block. */
export function editorBlockToNewsText(b: EditorTextBlock | EditorHeadingBlock): NewsTextBlock {
  if (b.type === 'heading') {
    return { type: 'text', text: b.text, mentions: [], links: [], marks: [], style: b.level };
  }
  return { type: 'text', text: b.text, mentions: b.mentions, links: b.links, marks: b.marks, style: 'paragraph' };
}

interface BlockEditorProps {
  blocks: EditorBlock[];
  onChange: (blocks: EditorBlock[]) => void;
  candidates: MentionCandidate[];
  textTestIDPrefix?: string;
}

/**
 * A block editor for news bodies — the mobile analogue of a WordPress editor,
 * kept deliberately simple: you write in a text area, and the "add section" /
 * "add image" actions drop a heading or image at the caret. That splits the
 * current paragraph in two (text before the caret / text after) with the new
 * block between, and guarantees a text box after it so writing can continue.
 * There is no separate "add paragraph" or manual reorder — the structure follows
 * from where headings and images go.
 */
export function BlockEditor({ blocks, onChange, candidates, textTestIDPrefix }: BlockEditorProps) {
  const { t } = useT();
  // The currently-focused text block and caret, tracked in a ref (no re-render
  // needed) so an image insert knows where to split.
  const active = useRef<{ id: string | null; caret: number }>({ id: null, caret: 0 });
  const imageBlockCount = blocks.filter((b) => b.type === 'image').length;

  function updateBlock(id: string, patch: Partial<EditorBlock>) {
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as EditorBlock) : b)));
  }

  // The block inserted last, focused on mount so the author can type its title.
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);

  // Removing an image or heading between two paragraphs merges them back into
  // one, so the author never ends up with invisibly-adjacent text blocks.
  function removeBlock(id: string) {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const prev = blocks[i - 1];
    const next = blocks[i + 1];
    if (prev?.type === 'text' && next?.type === 'text') {
      const sep = prev.text && next.text ? '\n\n' : '';
      const shift = prev.text.length + sep.length;
      const merged: EditorTextBlock = {
        id: prev.id,
        type: 'text',
        text: prev.text + sep + next.text,
        mentions: [...prev.mentions, ...next.mentions.map((m) => ({ ...m, offset: m.offset + shift }))],
        links: [...prev.links, ...next.links.map((l) => ({ ...l, offset: l.offset + shift }))],
        marks: [...prev.marks, ...next.marks.map((b) => ({ ...b, offset: b.offset + shift }))],
      };
      onChange([...blocks.slice(0, i - 1), merged, ...blocks.slice(i + 2)]);
    } else {
      onChange(blocks.filter((b) => b.id !== id));
    }
  }

  // Drop `inserted` at the caret of the focused paragraph, splitting it in two
  // (text before / text after). A text box always follows so writing can
  // continue. With no focused paragraph, the block is appended.
  function insertAtCaret(inserted: EditorBlock) {
    const i = active.current.id ? blocks.findIndex((b) => b.id === active.current.id) : -1;
    const target = i >= 0 ? blocks[i] : undefined;
    if (!target || target.type !== 'text') {
      onChange([...blocks, inserted, emptyTextBlock()]);
      return;
    }

    const caret = Math.min(Math.max(active.current.caret, 0), target.text.length);
    const { before, after } = splitMentionsAtCaret(target.mentions, caret);
    const { before: linksBefore, after: linksAfter } = splitMentionsAtCaret(target.links, caret);
    const { before: marksBefore, after: marksAfter } = splitMentionsAtCaret(target.marks, caret);
    const beforeBlock: EditorTextBlock = {
      id: target.id,
      type: 'text',
      text: target.text.slice(0, caret),
      mentions: before,
      links: linksBefore,
      marks: marksBefore,
    };
    const afterBlock: EditorTextBlock = {
      id: newBlockId(),
      type: 'text',
      text: target.text.slice(caret),
      mentions: after,
      links: linksAfter,
      marks: marksAfter,
    };
    const middle: EditorBlock[] = [];
    if (beforeBlock.text.length > 0) middle.push(beforeBlock);
    middle.push(inserted);
    middle.push(afterBlock);
    // The focused paragraph was consumed by the split; a later insert with no
    // re-focus must not act on its stale caret.
    active.current = { id: null, caret: 0 };
    onChange([...blocks.slice(0, i), ...middle, ...blocks.slice(i + 1)]);
  }

  async function addImageAtCaret() {
    const picked = await pickImageWithSize();
    if (!picked) return;
    insertAtCaret({
      id: newBlockId(),
      type: 'image',
      storagePath: null,
      blob: picked.blob,
      uri: picked.previewUri ?? null,
      width: picked.width,
      height: picked.height,
      caption: '',
      captionMentions: [],
      captionLinks: [],
      captionMarks: [],
    });
  }

  function addSectionAtCaret() {
    const heading: EditorHeadingBlock = { id: newBlockId(), type: 'heading', text: '', level: 'section' };
    setAutoFocusId(heading.id);
    insertAtCaret(heading);
  }

  return (
    <VStack gap={3}>
      {blocks.map((block, index) =>
        block.type === 'text' ? (
          <MentionTextInput
            key={block.id}
            value={block.text}
            mentions={block.mentions}
            links={block.links}
            marks={block.marks}
            candidates={candidates}
            placeholder={t('news.compose.block.textPlaceholder')}
            testID={textTestIDPrefix ? `${textTestIDPrefix}-${index}` : undefined}
            onChange={(text, mentions, links, marks) => updateBlock(block.id, { text, mentions, links, marks })}
            onFocus={() => {
              active.current = { id: block.id, caret: block.text.length };
            }}
            onSelectionChange={(caret) => {
              if (active.current.id === block.id) active.current.caret = caret;
            }}
          />
        ) : block.type === 'heading' ? (
          <HeadingBlock
            key={block.id}
            block={block}
            autoFocus={block.id === autoFocusId}
            onText={(text) => updateBlock(block.id, { text })}
            onLevel={(level) => updateBlock(block.id, { level })}
            onRemove={() => removeBlock(block.id)}
          />
        ) : (
          <ImageBlock
            key={block.id}
            block={block}
            candidates={candidates}
            captionPlaceholder={t('news.compose.block.captionPlaceholder')}
            removeLabel={t('news.compose.block.removeImage')}
            onCaption={(caption, captionMentions, captionLinks, captionMarks) =>
              updateBlock(block.id, { caption, captionMentions, captionLinks, captionMarks })}
            onRemove={() => removeBlock(block.id)}
          />
        ),
      )}

      <HStack gap={3}>
        <View className="flex-1">
          <AddBlockButton
            icon="text-outline"
            label={t('news.compose.block.addSection')}
            onPress={addSectionAtCaret}
          />
        </View>
        {imageBlockCount < MAX_IMAGE_BLOCKS ? (
          <View className="flex-1">
            <AddBlockButton
              icon="image-outline"
              label={t('news.compose.block.addImage')}
              onPress={() => void addImageAtCaret()}
            />
          </View>
        ) : null}
      </HStack>
    </VStack>
  );
}

function ImageBlock({
  block,
  candidates,
  captionPlaceholder,
  removeLabel,
  onCaption,
  onRemove,
}: {
  block: EditorImageBlock;
  candidates: MentionCandidate[];
  captionPlaceholder: string;
  removeLabel: string;
  onCaption: (
    caption: string,
    captionMentions: NewsMention[],
    captionLinks: NewsLink[],
    captionMarks: NewsMark[],
  ) => void;
  onRemove: () => void;
}) {
  return (
    <VStack gap={2}>
      <View
        className="overflow-hidden rounded-lg bg-surface"
        style={{ width: '100%', aspectRatio: block.width > 0 && block.height > 0 ? block.width / block.height : 16 / 9 }}
      >
        {block.uri ? (
          <Image
            source={{ uri: block.uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
          hitSlop={8}
          className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-black/50"
        >
          <Ionicons name="close" size={20} color="#ffffff" />
        </Pressable>
      </View>
      <MentionTextInput
        value={block.caption}
        mentions={block.captionMentions}
        links={block.captionLinks}
        marks={block.captionMarks}
        candidates={candidates}
        placeholder={captionPlaceholder}
        onChange={onCaption}
      />
    </VStack>
  );
}

function HeadingBlock({
  block,
  autoFocus,
  onText,
  onLevel,
  onRemove,
}: {
  block: EditorHeadingBlock;
  autoFocus: boolean;
  onText: (text: string) => void;
  onLevel: (level: HeadingLevel) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const placeholder = t(`news.compose.block.${block.level}Placeholder`);
  return (
    <VStack gap={2} className="rounded-md border border-subtle bg-surface px-3 py-2">
      <HStack gap={2} className="items-center">
        {HEADING_LEVELS.map((level) => {
          const selected = block.level === level;
          return (
            <Pressable
              key={level}
              onPress={() => onLevel(level)}
              accessibilityRole="button"
              accessibilityLabel={t(`news.compose.block.${level}`)}
              accessibilityState={{ selected }}
              className={`rounded-full border px-3 py-1 ${selected ? 'border-accent bg-surface-elevated' : 'border-subtle'}`}
            >
              <RNText className={`text-caption ${selected ? 'text-accent' : 'text-muted'}`}>
                {t(`news.compose.block.${level}`)}
              </RNText>
            </Pressable>
          );
        })}
        <View className="flex-1" />
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={t('news.compose.block.removeSection')}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center"
        >
          <Ionicons name="close" size={iconSizes.md} color={MUTED} />
        </Pressable>
      </HStack>
      <TextInput
        value={block.text}
        onChangeText={onText}
        autoFocus={autoFocus}
        placeholder={placeholder}
        placeholderTextColor={MUTED}
        accessibilityLabel={placeholder}
        className={`text-primary text-${HEADING_PRESENTATION[block.level].variant} ${HEADING_PRESENTATION[block.level].className}`}
        style={{ padding: 0 }}
        cursorColor={ACCENT}
        selectionColor={ACCENT}
      />
    </VStack>
  );
}

/** Dashed "add" affordance mirroring the pueblo tab's AddCard (dashed border,
 *  accent icon, centered label). */
function AddBlockButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="items-center justify-center gap-1 rounded-2xl border border-dashed border-subtle py-4"
    >
      <Ionicons name={icon} size={26} color={ACCENT} />
      <Text variant="bodySm" tone="muted" className="text-center">
        {label}
      </Text>
    </Pressable>
  );
}
