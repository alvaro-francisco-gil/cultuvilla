import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Text, VStack } from '../primitives';
import { useT } from '../../lib/i18n';

export interface LinkSheetProps {
  /** The detected URL; non-null makes the sheet visible. */
  url: string | null;
  /** Called with the display text (empty string = keep as autolinked raw URL). */
  onSave: (displayText: string) => void;
  onDismiss: () => void;
}

export function LinkSheet({ url, onSave, onDismiss }: LinkSheetProps) {
  const { t } = useT();
  const [text, setText] = useState('');

  useEffect(() => {
    if (url) setText('');
  }, [url]);

  if (!url) return null;

  return (
    <View className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-subtle bg-surface-elevated p-4">
      <VStack gap={3}>
        <Text variant="h3">{t('news.linkSheet.title')}</Text>
        <VStack gap={1}>
          <Text variant="caption" tone="muted">
            {t('news.linkSheet.urlLabel')}
          </Text>
          <Text numberOfLines={1} tone="primary" className="text-accent">
            {url}
          </Text>
        </VStack>
        <Input
          label={t('news.linkSheet.textLabel')}
          value={text}
          onChangeText={setText}
          placeholder={t('news.linkSheet.textPlaceholder')}
          autoFocus
        />
        <View className="flex-row justify-end gap-2">
          <Button variant="ghost" onPress={onDismiss}>
            {t('news.linkSheet.skip')}
          </Button>
          <Button onPress={() => onSave(text.trim())}>{t('news.linkSheet.save')}</Button>
        </View>
      </VStack>
    </View>
  );
}
