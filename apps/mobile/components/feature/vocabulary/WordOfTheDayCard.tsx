import { View } from 'react-native';
import { router } from 'expo-router';
import { spacing, typography } from '@cultuvilla/shared/design-system';
import { termSlugFromId } from '@cultuvilla/shared/models';
import { Pressable, Text, VStack } from '../../primitives';
import { SectionHeader } from '../VillageSections';
import { villageSectionHref, wordHref } from '../../../lib/navigation/routes';
import type { WordOfTheDay } from '../../../lib/useVillageHome';
import { useT } from '../../../lib/i18n';

/** A saying runs to a whole sentence; the display size is for a single headword. */
const LONG_TERM_CHARS = 18;

/**
 * The village home's vocabulary section: one word featured for the day, with
 * its first meaning and example. Typography carries it — a pueblo's words
 * rarely come with pictures.
 */
export function WordOfTheDayCard({
  word,
  count,
  villageSlug,
  villageName,
}: {
  word: WordOfTheDay;
  count: number;
  villageSlug: string;
  villageName: string;
}) {
  const { t } = useT();
  const { term, definition } = word;
  const headword = term.term.length > LONG_TERM_CHARS ? typography.h2 : typography.display;

  return (
    <VStack gap={3} className="pt-4">
      <SectionHeader
        title={t('village.vocabulary.title', { village: villageName })}
        actionLabel={t('village.vocabulary.seeAll', { count })}
        onAction={() => router.push(villageSectionHref(villageSlug, 'vocabulario'))}
      />
      <View className="mx-4 rounded-2xl bg-surface-elevated border border-subtle">
        <Pressable
          onPress={() => router.push(wordHref(villageSlug, termSlugFromId(term.id)))}
          accessibilityRole="button"
          accessibilityLabel={term.term}
          testID="home-word-of-the-day"
          style={{ padding: 20, gap: spacing[2] }}
        >
          <Text
            variant="caption"
            className="font-semibold uppercase text-accent"
            style={{ letterSpacing: 1 }}
          >
            {t(`village.vocabulary.wordOfTheDay.${term.kind}`)}
          </Text>
          <Text className="font-bold" style={{ fontSize: headword.fontSize, lineHeight: headword.lineHeight + 4 }}>
            {term.term}
          </Text>
          {definition ? (
            <Text className="text-on-subtle">{definition.definition}</Text>
          ) : null}
          {definition?.example ? (
            <Text className="italic" style={{ marginTop: spacing[1] }}>
              {`«${definition.example}»`}
            </Text>
          ) : null}
        </Pressable>
      </View>
    </VStack>
  );
}
