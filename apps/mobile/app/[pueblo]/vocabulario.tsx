import { newWordHref, wordHref } from '../../lib/navigation/routes';
import { presentVocabularyKinds, termSlugFromId, type VocabularyTermKind } from '@cultuvilla/shared/models';
import { useVillageRoute, withVillageRoute } from '../../lib/navigation/VillageRouteGate';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { iconSizes, colors } from '@cultuvilla/shared/design-system';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { HStack } from '../../components/primitives/HStack';
import { VStack } from '../../components/primitives/VStack';
import { Input } from '../../components/primitives/Input';
import { Pressable } from '../../components/primitives/Pressable';
import { Fab } from '../../components/primitives/Fab';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { SegmentedToggle } from '../../components/feature/SegmentedToggle';
import { useT } from '../../lib/i18n';
import { useEntityCapabilities } from '../../lib/auth/useEntityCapabilities';
import {
  getVocabularyTerms,
  type VocabularyTermWithId,
} from '@cultuvilla/shared/services/vocabularyService';
import { slugifyTerm } from '@cultuvilla/shared/models/vocabulary';

/**
 * The pueblo's shared vocabulary, A–Z, one tab per kind it has recorded.
 *
 * The whole glossary is fetched once and the search box filters it in memory:
 * a village glossary is tens to a few hundred headwords, so a server-side
 * prefix query would cost an index and a round trip per keystroke to search a
 * list that already fits in one. Matching runs on the accent-folded form, so
 * "napa" finds "ñapa" and "esbardo" finds "Esbardo". A search spans every
 * kind, so a saying is found from the Palabras tab too — someone looking a
 * phrase up rarely knows which kind it was filed under.
 */
function VocabularyScreen() {
  const {
    municipalityId: villageId,
    slug: villageSlug,
    name: villageName,
  } = useVillageRoute();
  const { t } = useT();
  const { isMember } = useEntityCapabilities(villageId);
  const [terms, setTerms] = useState<VocabularyTermWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedKind, setSelectedKind] = useState<VocabularyTermKind | null>(null);

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

  const kinds = useMemo(() => presentVocabularyKinds(terms), [terms]);
  const activeKind = selectedKind && kinds.includes(selectedKind) ? selectedKind : kinds[0];
  const searching = slugifyTerm(search) !== '';

  const visible = useMemo(() => {
    const needle = slugifyTerm(search);
    if (!needle) return terms.filter((term) => term.kind === activeKind);
    return terms.filter(
      (term) => term.normalized.includes(needle) || slugifyTerm(term.term).includes(needle),
    );
  }, [terms, search, activeKind]);

  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title={t('village.vocabulary.title', { village: villageName })} />
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
      {kinds.length > 1 && activeKind && !searching ? (
        <View className="px-4 pt-2 pb-1">
          <SegmentedToggle<VocabularyTermKind>
            options={kinds.map((kind) => ({
              value: kind,
              label: t(`village.vocabulary.kindPlural.${kind}`),
            }))}
            value={activeKind}
            onChange={setSelectedKind}
          />
        </View>
      ) : null}
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
            onPress={() => router.push(wordHref(villageSlug, termSlugFromId(item.id)))}
            testID={`vocabulary-term-${item.id}`}
          >
            <HStack gap={3} className="items-center">
              <Text className="font-bold flex-1">{item.term}</Text>
              <Ionicons name="chevron-forward" size={iconSizes.sm} color={colors.light.fg.muted} />
            </HStack>
          </Pressable>
        )}
      />
      {isMember ? (
        <Fab
          label={t('village.vocabulary.add')}
          onPress={() => router.push(newWordHref(villageSlug))}
          testID="vocabulary-add-fab"
        />
      ) : null}
    </Screen>
  );
}

export default withVillageRoute(VocabularyScreen);
