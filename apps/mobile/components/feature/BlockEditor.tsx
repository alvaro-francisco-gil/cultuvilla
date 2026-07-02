import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@cultuvilla/shared/design-system';
import { HStack, Input, Pressable, Text, VStack } from '../primitives';
import { useT } from '../../lib/i18n';
import { pickImageWithSize } from '../../lib/images';
import { MentionTextInput } from './MentionTextInput';
import type { MentionCandidate } from '../../lib/mentionText';
import type { NewsMention } from '@cultuvilla/shared/models/news/NewsPostDataModel';

const ACCENT = colors.light.fg.accent;

/**
 * Editor-side block. Distinct from the persisted `NewsBlock`: it carries a
 * stable `id` for list keys/reordering, and image blocks hold either an
 * already-uploaded `storagePath` (edit mode) or a freshly-picked `blob` awaiting
 * upload on submit. The parent screen maps these to `NewsBlock`s at save time.
 */
export type EditorTextBlock = {
  id: string;
  type: 'text';
  text: string;
  mentions: NewsMention[];
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
};
export type EditorBlock = EditorTextBlock | EditorImageBlock;

let blockSeq = 0;
export function newBlockId(): string {
  blockSeq += 1;
  return `b${blockSeq}-${Date.now()}`;
}

export function emptyTextBlock(): EditorTextBlock {
  return { id: newBlockId(), type: 'text', text: '', mentions: [] };
}

interface BlockEditorProps {
  blocks: EditorBlock[];
  onChange: (blocks: EditorBlock[]) => void;
  candidates: MentionCandidate[];
}

/**
 * A vertical block editor for news bodies — the mobile analogue of a
 * WordPress/Gutenberg editor. Paragraphs (with `@`-mentions) and images are
 * interleaved; each block can move up/down or be removed. Reordering is via
 * arrows rather than drag: RN drag-reorder inside a scroll view is fiddly and
 * arrows are unambiguous on touch.
 */
export function BlockEditor({ blocks, onChange, candidates }: BlockEditorProps) {
  const { t } = useT();

  function updateBlock(id: string, patch: Partial<EditorBlock>) {
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as EditorBlock) : b)));
  }

  function removeBlock(id: string) {
    onChange(blocks.filter((b) => b.id !== id));
  }

  function move(id: string, dir: -1 | 1) {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(i, 1);
    next.splice(j, 0, moved!);
    onChange(next);
  }

  function addText() {
    onChange([...blocks, emptyTextBlock()]);
  }

  async function addImage() {
    const picked = await pickImageWithSize();
    if (!picked) return;
    onChange([
      ...blocks,
      {
        id: newBlockId(),
        type: 'image',
        storagePath: null,
        blob: picked.blob,
        uri: picked.previewUri ?? null,
        width: picked.width,
        height: picked.height,
        caption: '',
      },
    ]);
  }

  return (
    <VStack gap={3}>
      {blocks.map((block, i) => (
        <VStack key={block.id} gap={1} className="rounded-lg border border-subtle p-2">
          <BlockToolbar
            canMoveUp={i > 0}
            canMoveDown={i < blocks.length - 1}
            onUp={() => move(block.id, -1)}
            onDown={() => move(block.id, 1)}
            onRemove={() => removeBlock(block.id)}
            label={
              block.type === 'text' ? t('news.compose.block.text') : t('news.compose.block.image')
            }
          />
          {block.type === 'text' ? (
            <MentionTextInput
              value={block.text}
              mentions={block.mentions}
              candidates={candidates}
              placeholder={t('news.compose.block.textPlaceholder')}
              onChange={(text, mentions) => updateBlock(block.id, { text, mentions })}
            />
          ) : (
            <VStack gap={2}>
              <View
                className="overflow-hidden rounded-md bg-surface"
                style={{
                  width: '100%',
                  aspectRatio: block.width > 0 && block.height > 0 ? block.width / block.height : 16 / 9,
                }}
              >
                {block.uri ? (
                  <Image
                    source={{ uri: block.uri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : null}
              </View>
              <Input
                value={block.caption}
                onChangeText={(caption) => updateBlock(block.id, { caption })}
                placeholder={t('news.compose.block.captionPlaceholder')}
                dense
              />
            </VStack>
          )}
        </VStack>
      ))}

      <HStack gap={2}>
        <AddBlockButton icon="text-outline" label={t('news.compose.block.addText')} onPress={addText} />
        <AddBlockButton icon="image-outline" label={t('news.compose.block.addImage')} onPress={() => void addImage()} />
      </HStack>
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
      className="flex-1 items-center justify-center gap-1 rounded-2xl border border-dashed border-subtle py-4"
    >
      <Ionicons name={icon} size={26} color={ACCENT} />
      <Text variant="bodySm" tone="muted" className="text-center">
        {label}
      </Text>
    </Pressable>
  );
}

function BlockToolbar({
  canMoveUp,
  canMoveDown,
  onUp,
  onDown,
  onRemove,
  label,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  label: string;
}) {
  return (
    <HStack gap={2} className="items-center justify-between">
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <HStack gap={3} className="items-center">
        <Pressable onPress={onUp} disabled={!canMoveUp} hitSlop={8} accessibilityLabel="move-up">
          <Ionicons name="arrow-up" size={20} color={canMoveUp ? ACCENT : '#cbd5e1'} />
        </Pressable>
        <Pressable onPress={onDown} disabled={!canMoveDown} hitSlop={8} accessibilityLabel="move-down">
          <Ionicons name="arrow-down" size={20} color={canMoveDown ? ACCENT : '#cbd5e1'} />
        </Pressable>
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel="remove-block">
          <Ionicons name="trash-outline" size={20} color="#94a3b8" />
        </Pressable>
      </HStack>
    </HStack>
  );
}
