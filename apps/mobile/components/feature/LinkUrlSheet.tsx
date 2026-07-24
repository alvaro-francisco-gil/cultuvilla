import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Input, Pressable, Text, VStack } from '../primitives';
import { useT } from '../../lib/i18n';
import { isSafeHttpUrl } from '../../lib/linkText';

export interface LinkUrlSheetProps {
  /** The selected display text; non-null makes the sheet visible. */
  displayText: string | null;
  /** Called with a validated http(s) URL. */
  onSave: (url: string) => void;
  onDismiss: () => void;
  /** Y-offset (px, within the nearest positioned ancestor) to anchor the sheet
   *  just below — typically the caret's line. Falls back to the screen bottom
   *  when omitted. */
  anchorTop?: number;
}

/**
 * Companion to {@link LinkSheet} for the inverse flow: the author already
 * selected the display text and taps the toolbar's link button, so here we ask
 * for the URL. Guardar stays disabled until the field holds a safe http(s) URL.
 */
export function LinkUrlSheet({ displayText, onSave, onDismiss, anchorTop }: LinkUrlSheetProps) {
  const { t } = useT();
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (displayText !== null) setUrl('');
  }, [displayText]);

  if (displayText === null) return null;

  const valid = isSafeHttpUrl(url.trim());

  return (
    <View
      testID="link-url-sheet"
      className="absolute inset-x-4 rounded-xl border border-subtle bg-surface-elevated px-3 py-2 shadow-md"
      style={anchorTop != null ? { top: anchorTop } : { bottom: 8 }}
    >
      <VStack gap={2}>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {displayText}
        </Text>
        <Input
          dense
          value={url}
          onChangeText={setUrl}
          placeholder={t('news.linkSheet.urlPlaceholder')}
          autoFocus
          autoCapitalize="none"
          keyboardType="url"
          rightAdornment={
            <Pressable
              onPress={() => valid && onSave(url.trim())}
              disabled={!valid}
              accessibilityRole="button"
              accessibilityLabel={t('news.linkSheet.save')}
              accessibilityState={{ disabled: !valid }}
              hitSlop={8}
            >
              <Text className={valid ? 'text-accent font-medium' : 'text-muted font-medium'}>
                {t('news.linkSheet.save')}
              </Text>
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
