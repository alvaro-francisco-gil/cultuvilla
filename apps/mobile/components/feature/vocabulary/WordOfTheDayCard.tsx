import { View } from 'react-native';
import { router } from 'expo-router';
import { spacing, typography } from '@cultuvilla/shared/design-system';
import { termSlugFromId } from '@cultuvilla/shared/models';
import { HStack, Pressable, Text, VStack } from '../../primitives';
import { SectionHeader } from '../VillageSections';
import { villageSectionHref, wordHref } from '../../../lib/navigation/routes';
import type { WordOfTheDay } from '../../../lib/useVillageHome';
import { useT } from '../../../lib/i18n';

/** A saying runs to a whole sentence; the display size is for a single headword. */
const LONG_TERM_CHARS = 18;

/**
 * The village home's vocabulary section: one word featured for the day, its
 * first meaning and example, and a few more words to wander on to. Typography
 * carries it — a pueblo's words rarely come with pictures.
 */
export function WordOfTheDayCard({
  word,
  count,
  villageSlug,
}: {
  word: WordOfTheDay;
  count: number;
  villageSlug: string;
}) {
  const { t } = useT();
  const { term, definition, more } = word;
  const openTerm = (termId: string) => router.push(wordHref(villageSlug, termSlugFromId(termId)));
  const headword = term.term.length > LONG_TERM_CHARS ? typography.h2 : typography.display;

  return (
    <VStack gap={3} className="pt-4">
      <SectionHeader
        title={t('village.vocabulary.title')}
        actionLabel={t('village.vocabulary.seeAll', { count })}
        onAction={() => router.push(villageSectionHref(villageSlug, 'vocabulario'))}
      />
      <View className="mx-4 rounded-2xl bg-surface-elevated border border-subtle">
        <Pressable
          onPress={() => openTerm(term.id)}
          accessibilityRole="button"
          accessibilityLabel={term.term}
          testID="home-word-of-the-day"
          style={{ padding: 20, gap: spacing[2] }}
        >
          <HStack className="items-center justify-between">
            <Text
              variant="caption"
              className="font-semibold uppercase text-accent"
              style={{ letterSpacing: 1 }}
            >
              {t('village.vocabulary.wordOfTheDay')}
            </Text>
            <View className="rounded-xl bg-surface" style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text variant="caption" className="text-on-subtle">
                {t(`village.vocabulary.kind.${term.kind}`)}
              </Text>
            </View>
          </HStack>
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
        {more.length > 0 ? (
          <View
            className="flex-row items-center flex-wrap border-t border-subtle"
            style={{ paddingHorizontal: 20, minHeight: 44, columnGap: spacing[2] }}
          >
            <Text variant="bodySm" tone="muted">
              {t('village.vocabulary.more')}
            </Text>
            {more.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => openTerm(m.id)}
                accessibilityRole="button"
                accessibilityLabel={m.term}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text variant="bodySm" className="font-medium text-accent">
                  {m.term}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </VStack>
  );
}
