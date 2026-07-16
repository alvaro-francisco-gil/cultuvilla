import { useRef } from 'react';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@cultuvilla/shared/design-system';
import { Pressable, Text, VStack } from '../primitives';
import { useT } from '../../lib/i18n';
import { pickImageWithSize } from '../../lib/images';
import { MentionTextInput } from './MentionTextInput';
import { splitMentionsAtCaret, type MentionCandidate } from '../../lib/mentionText';
import type { NewsMention, NewsLink, NewsBold } from '@cultuvilla/shared/models/news/NewsPostDataModel';

const ACCENT = colors.light.fg.accent;

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
  bolds: NewsBold[];
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
  captionBolds: NewsBold[];
};
export type EditorBlock = EditorTextBlock | EditorImageBlock;

let blockSeq = 0;
export function newBlockId(): string {
  blockSeq += 1;
  return `b${blockSeq}-${Date.now()}`;
}

export function emptyTextBlock(): EditorTextBlock {
  return { id: newBlockId(), type: 'text', text: '', mentions: [], links: [], bolds: [] };
}

interface BlockEditorProps {
  blocks: EditorBlock[];
  onChange: (blocks: EditorBlock[]) => void;
  candidates: MentionCandidate[];
}

/**
 * A block editor for news bodies — the mobile analogue of a WordPress editor,
 * kept deliberately simple: you write in a text area, and the single "add image"
 * action drops an image at the caret. That splits the current paragraph in two
 * (text before the caret / text after) with the image between, and guarantees a
 * text box after the image so writing can continue. There is no separate
 * "add paragraph" or manual reorder — the structure follows from where images go.
 */
export function BlockEditor({ blocks, onChange, candidates }: BlockEditorProps) {
  const { t } = useT();
  // The currently-focused text block and caret, tracked in a ref (no re-render
  // needed) so an image insert knows where to split.
  const active = useRef<{ id: string | null; caret: number }>({ id: null, caret: 0 });

  function updateBlock(id: string, patch: Partial<EditorBlock>) {
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as EditorBlock) : b)));
  }

  // Removing an image between two text blocks merges them back into one, so the
  // author never ends up with invisibly-adjacent text blocks.
  function removeImage(id: string) {
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
        bolds: [...prev.bolds, ...next.bolds.map((b) => ({ ...b, offset: b.offset + shift }))],
      };
      onChange([...blocks.slice(0, i - 1), merged, ...blocks.slice(i + 2)]);
    } else {
      onChange(blocks.filter((b) => b.id !== id));
    }
  }

  async function addImageAtCaret() {
    const picked = await pickImageWithSize();
    if (!picked) return;
    const image: EditorImageBlock = {
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
      captionBolds: [],
    };

    const i = active.current.id ? blocks.findIndex((b) => b.id === active.current.id) : -1;
    const target = i >= 0 ? blocks[i] : undefined;
    if (!target || target.type !== 'text') {
      // No focused paragraph — append the image and a fresh text box to write in.
      onChange([...blocks, image, emptyTextBlock()]);
      return;
    }

    const caret = Math.min(Math.max(active.current.caret, 0), target.text.length);
    const { before, after } = splitMentionsAtCaret(target.mentions, caret);
    const { before: linksBefore, after: linksAfter } = splitMentionsAtCaret(target.links, caret);
    const { before: boldsBefore, after: boldsAfter } = splitMentionsAtCaret(target.bolds, caret);
    const beforeBlock: EditorTextBlock = {
      id: target.id,
      type: 'text',
      text: target.text.slice(0, caret),
      mentions: before,
      links: linksBefore,
      bolds: boldsBefore,
    };
    const afterBlock: EditorTextBlock = {
      id: newBlockId(),
      type: 'text',
      text: target.text.slice(caret),
      mentions: after,
      links: linksAfter,
      bolds: boldsAfter,
    };
    const middle: EditorBlock[] = [];
    if (beforeBlock.text.length > 0) middle.push(beforeBlock);
    middle.push(image);
    middle.push(afterBlock); // always leave a text box after the image
    onChange([...blocks.slice(0, i), ...middle, ...blocks.slice(i + 1)]);
  }

  return (
    <VStack gap={3}>
      {blocks.map((block) =>
        block.type === 'text' ? (
          <MentionTextInput
            key={block.id}
            value={block.text}
            mentions={block.mentions}
            links={block.links}
            bolds={block.bolds}
            candidates={candidates}
            placeholder={t('news.compose.block.textPlaceholder')}
            onChange={(text, mentions, links, bolds) => updateBlock(block.id, { text, mentions, links, bolds })}
            onFocus={() => {
              active.current = { id: block.id, caret: block.text.length };
            }}
            onSelectionChange={(caret) => {
              if (active.current.id === block.id) active.current.caret = caret;
            }}
          />
        ) : (
          <ImageBlock
            key={block.id}
            block={block}
            candidates={candidates}
            captionPlaceholder={t('news.compose.block.captionPlaceholder')}
            removeLabel={t('news.compose.block.removeImage')}
            onCaption={(caption, captionMentions, captionLinks, captionBolds) =>
              updateBlock(block.id, { caption, captionMentions, captionLinks, captionBolds })}
            onRemove={() => removeImage(block.id)}
          />
        ),
      )}

      <AddBlockButton
        icon="image-outline"
        label={t('news.compose.block.addImage')}
        onPress={() => void addImageAtCaret()}
      />
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
    captionBolds: NewsBold[],
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
        bolds={block.captionBolds}
        candidates={candidates}
        placeholder={captionPlaceholder}
        onChange={onCaption}
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
