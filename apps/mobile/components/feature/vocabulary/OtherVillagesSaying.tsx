import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { termSlugFromId } from '@cultuvilla/shared/models';
import { Ionicons } from '@expo/vector-icons';
import { iconSizes, colors } from '@cultuvilla/shared/design-system';
import { Text } from '../../primitives/Text';
import { VStack } from '../../primitives/VStack';
import { HStack } from '../../primitives/HStack';
import { Pressable } from '../../primitives/Pressable';
import { DetailSectionHeading } from '../DetailSectionHeading';
import { useT } from '../../../lib/i18n';
import { wordHref } from '../../../lib/navigation/routes';
import {
  getVillagesSayingTerm,
  type VocabularyTermWithId,
} from '@cultuvilla/shared/services/vocabularyService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';

/**
 * "También se dice en…" — the other pueblos that record this same word.
 *
 * Words repeating across villages is the thing this section turns from a
 * duplication problem into the interesting part: the same word, and how each
 * pueblo explains it. Tapping through opens that village's entry, meanings and
 * all.
 */
export function OtherVillagesSaying({
  normalized,
  municipalityId,
}: {
  normalized: string;
  municipalityId: string;
}) {
  const { t } = useT();
  const [entries, setEntries] = useState<(VocabularyTermWithId & { villageName?: string; villageSlug?: string })[]>([]);

  useEffect(() => {
    let cancelled = false;
    void getVillagesSayingTerm(normalized, municipalityId)
      .then(async (found) => {
        // One name lookup per village. The list is short by nature — a word is
        // in a handful of pueblos, not hundreds — so this stays a few reads.
        const named = await Promise.all(
          found.map(async (entry) => {
            const municipality = await getMunicipality(entry.municipalityId);
            return { ...entry, villageName: municipality?.name, villageSlug: municipality?.slug };
          }),
        );
        if (!cancelled) setEntries(named);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [normalized, municipalityId]);

  const linkable = entries.filter(
    (entry): entry is typeof entry & { villageSlug: string } => Boolean(entry.villageSlug),
  );
  if (linkable.length === 0) return null;

  return (
    <VStack gap={2} testID="vocabulary-other-villages">
      <DetailSectionHeading>{t('village.vocabulary.alsoSaidIn')}</DetailSectionHeading>
      {linkable.map((entry) => (
        <Pressable
          key={entry.id}
          className="py-2 border-b border-subtle"
          onPress={() => router.push(wordHref(entry.villageSlug, termSlugFromId(entry.id)))}
          testID={`vocabulary-other-village-${entry.municipalityId}`}
        >
          <HStack gap={3} className="items-center">
            <VStack gap={0} className="flex-1">
              <Text>{entry.villageName ?? entry.municipalityId}</Text>
              <Text tone="muted" variant="bodySm">
                {t('village.vocabulary.definitionCount', { count: entry.definitionCount })}
              </Text>
            </VStack>
            <Ionicons name="chevron-forward" size={iconSizes.sm} color={colors.light.fg.muted} />
          </HStack>
        </Pressable>
      ))}
    </VStack>
  );
}
