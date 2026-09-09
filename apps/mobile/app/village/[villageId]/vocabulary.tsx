import { useCallback, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { iconSizes, colors } from '@cultuvilla/shared/design-system';
import { Screen } from '../../../components/primitives/Screen';
import { Text } from '../../../components/primitives/Text';
import { HStack } from '../../../components/primitives/HStack';
import { VStack } from '../../../components/primitives/VStack';
import { Input } from '../../../components/primitives/Input';
import { Pressable } from '../../../components/primitives/Pressable';
import { Fab } from '../../../components/primitives/Fab';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import {
  getVocabularyTerms,
  type VocabularyTermWithId,
} from '@cultuvilla/shared/services/vocabularyService';
import { slugifyTerm } from '@cultuvilla/shared/models/vocabulary';

/**
 * The pueblo's shared vocabulary, A–Z.
 *
 * The whole glossary is fetched once and the search box filters it in memory:
 * a village glossary is tens to a few hundred headwords, so a server-side
 * prefix query would cost an index and a round trip per keystroke to search a
 * list that already fits in one. Matching runs on the accent-folded form, so
 * "napa" finds "ñapa" and "esbardo" finds "Esbardo".
 */
export default function VocabularyScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const { isMember } = useEntityCapabilities(villageId);
  const [terms, setTerms] = useState<VocabularyTermWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!villageId) return;
    try {
      setTerms(await getVocabularyTerms(villageId));
    } finally {
      setLoading(false);
    }
  }, [villageId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible = useMemo(() => {
    const needle = slugifyTerm(search);
    if (!needle) return terms;
    return terms.filter(
      (term) => term.normalized.includes(needle) || slugifyTerm(term.term).includes(needle),
    );
  }, [terms, search]);

  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title={t('village.vocabulary.title')} />
      <View className="px-4 pt-2 pb-1">
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder={t('village.vocabulary.search')}
          autoCapitalize="none"
          autoCorrect={false}
          dense
          testID="vocabulary-search"
        />
      </View>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}
        ListEmptyComponent={
          loading ? null : (
            <VStack gap={2} className="pt-8 items-center">
              <Text tone="muted" className="text-center">
                {search ? t('village.vocabulary.noMatches') : t('village.vocabulary.empty')}
              </Text>
            </VStack>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            className="py-3 border-b border-subtle"
            onPress={() => router.push(`/village/${villageId}/word/${item.id}` as never)}
            testID={`vocabulary-term-${item.id}`}
          >
            <HStack gap={3} className="items-center">
              <VStack gap={0} className="flex-1">
                <Text className="font-bold">{item.term}</Text>
                <Text tone="muted" variant="bodySm">
                  {[
                    t(`village.vocabulary.kind.${item.kind}`),
                    t('village.vocabulary.definitionCount', { count: item.definitionCount }),
                  ].join(' · ')}
                </Text>
              </VStack>
              <Ionicons name="chevron-forward" size={iconSizes.sm} color={colors.light.fg.muted} />
            </HStack>
          </Pressable>
        )}
      />
      {isMember ? (
        <Fab
          label={t('village.vocabulary.add')}
          onPress={() => router.push(`/village/${villageId}/word/new` as never)}
          testID="vocabulary-add-fab"
        />
      ) : null}
    </Screen>
  );
}
