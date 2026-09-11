import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../primitives/Text';
import { VStack } from '../../primitives/VStack';
import { HStack } from '../../primitives/HStack';
import { Pressable } from '../../primitives/Pressable';
import { useT } from '../../../lib/i18n';
import {
  searchVocabularyWords,
  type VocabularyWordWithId,
} from '@cultuvilla/shared/services/vocabularyService';

/** Below this, a prefix matches most of the dictionary and suggests nothing useful. */
const MIN_QUERY_LENGTH = 2;
/** Long enough that a pause reads as "done typing", short enough to feel live. */
const DEBOUNCE_MS = 250;

/**
 * Words other villages have already recorded, offered while the villager types.
 *
 * Duplicates are prevented by the derived id, not by this list — typing the
 * word out in full joins the existing one either way. What this buys is that
 * the villager *knows* before submitting, and can take the established
 * spelling instead of coining a near-miss.
 */
export function ExistingWordSuggestions({
  query,
  onPick,
}: {
  query: string;
  onPick: (word: VocabularyWordWithId) => void;
}) {
  const { t } = useT();
  const [words, setWords] = useState<VocabularyWordWithId[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setWords([]);
      return;
    }
    let cancelled = false;
    // Debounced: one query per pause, not one per keystroke.
    const handle = setTimeout(() => {
      searchVocabularyWords(trimmed)
        .then((found) => {
          if (!cancelled) setWords(found);
        })
        .catch(() => {
          // A failed suggestion lookup must never block writing the word down.
          if (!cancelled) setWords([]);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  if (words.length === 0) return null;

  return (
    <VStack gap={2} testID="vocabulary-suggestions">
      <Text tone="muted" variant="bodySm">
        {t('village.vocabulary.alreadyRecorded')}
      </Text>
      <View className="border border-subtle rounded-md">
        {words.map((word) => (
          <Pressable
            key={word.id}
            onPress={() => onPick(word)}
            className="px-3 py-2 border-b border-subtle"
            testID={`vocabulary-suggestion-${word.id}`}
          >
            <HStack gap={2} className="items-baseline">
              <Text className="font-bold">{word.term}</Text>
              <Text tone="muted" variant="bodySm">
                {t('village.vocabulary.inVillages', { count: word.villageCount })}
              </Text>
            </HStack>
          </Pressable>
        ))}
      </View>
    </VStack>
  );
}
