import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Input, Pressable, Text, VStack } from '../primitives';
import { useT } from '../../lib/i18n';

export interface LinkSheetProps {
  /** The detected URL; non-null makes the sheet visible. */
  url: string | null;
  /** Called with the display text (empty string = keep as autolinked raw URL). */
  onSave: (displayText: string) => void;
  onDismiss: () => void;
}

/**
 * Minimal floating card shown right after a URL is pasted: the URL for context,
 * a single optional-display-text field with an inline Guardar, and a quiet Omitir.
 * Deliberately small and inset from the edges so it doesn't cover the article.
 */
export function LinkSheet({ url, onSave, onDismiss }: LinkSheetProps) {
  const { t } = useT();
  const [text, setText] = useState('');

  useEffect(() => {
    if (url) setText('');
  }, [url]);

  if (!url) return null;

  return (
    <View className="absolute inset-x-4 bottom-2 rounded-xl border border-subtle bg-surface-elevated px-3 py-2 shadow-md">
      <VStack gap={2}>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {url}
        </Text>
        <Input
          dense
          value={text}
          onChangeText={setText}
          placeholder={t('news.linkSheet.textPlaceholder')}
          autoFocus
          rightAdornment={
            <Pressable
              onPress={() => onSave(text.trim())}
              accessibilityRole="button"
              accessibilityLabel={t('news.linkSheet.save')}
              hitSlop={8}
            >
              <Text className="text-accent font-medium">{t('news.linkSheet.save')}</Text>
            </Pressable>
          }
        />
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('news.linkSheet.skip')}
          hitSlop={8}
          className="self-end"
        >
          <Text variant="caption" tone="muted">
            {t('news.linkSheet.skip')}
          </Text>
        </Pressable>
      </VStack>
    </View>
  );
}
