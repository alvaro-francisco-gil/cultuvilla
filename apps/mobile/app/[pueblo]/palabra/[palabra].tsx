import { useCallback, useState } from 'react';
import { Platform, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { iconSizes, colors } from '@cultuvilla/shared/design-system';
import { Screen } from '../../../components/primitives/Screen';
import { Text } from '../../../components/primitives/Text';
import { HStack } from '../../../components/primitives/HStack';
import { VStack } from '../../../components/primitives/VStack';
import { Button } from '../../../components/primitives/Button';
import { Pressable } from '../../../components/primitives/Pressable';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { ScreenTitle } from '../../../components/primitives/ScreenTitle';
import { DetailSectionHeading } from '../../../components/feature/DetailSectionHeading';
import { EntityComments } from '../../../components/feature/EntityComments';
import { OtherVillagesSaying } from '../../../components/feature/vocabulary/OtherVillagesSaying';
import { EntityContributors } from '../../../components/feature/EntityContributors';
import { ReportSheet, type ReportTarget } from '../../../components/feature/ReportSheet';
import { useT } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth/useAuth';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import {
  deleteVocabularyDefinition,
  deleteVocabularyTerm,
  getVocabularyDefinitions,
  getVocabularyTerm,
  type VocabularyDefinitionWithId,
  type VocabularyTermWithId,
} from '@cultuvilla/shared/services/vocabularyService';
import { recordEntityView } from '@cultuvilla/shared/services/commentsService';
import { formatDate } from '@cultuvilla/shared/utils';
import { vocabularyTermId } from '@cultuvilla/shared/models';
import { useVillageRoute, withVillageRoute } from '../../../lib/navigation/VillageRouteGate';

/**
 * One headword and every meaning the pueblo has given it.
 *
 * Deliberately NOT an `EntityDetailScaffold` consumer: a word has no hero image
 * and no card scroll, so it is a plain `ScreenHeader` screen. It does carry
 * comments, which is why `vocabularyTerm` is in `ENTITY_KINDS` — that list is
 * "comment-capable kinds", not the hero-detail entity family.
 */
function VocabularyTermScreen() {
  const { municipalityId: villageId } = useVillageRoute();
  const { palabra } = useLocalSearchParams<{ palabra: string }>();
  // A term's doc id is `<municipalityId>__<slug>`; the URL carries the slug.
  const termId = palabra ? vocabularyTermId(villageId, palabra) : '';
  const { t } = useT();
  const { user } = useAuth();
  const { canManage, isMember } = useEntityCapabilities(villageId);

  const [term, setTerm] = useState<VocabularyTermWithId | null>(null);
  const [definitions, setDefinitions] = useState<VocabularyDefinitionWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const load = useCallback(async () => {
    if (!termId) return;
    try {
      const [loadedTerm, loadedDefinitions] = await Promise.all([
        getVocabularyTerm(termId),
        getVocabularyDefinitions(termId),
      ]);
      setTerm(loadedTerm);
      setDefinitions(loadedDefinitions);
    } finally {
      setLoading(false);
    }
  }, [termId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!termId || !villageId) return;
      void recordEntityView({
        entityKind: 'vocabularyTerm',
        entityId: termId,
        municipalityId: villageId,
      }).catch(() => {});
    }, [termId, villageId]),
  );

  async function removeDefinition(definitionId: string) {
    await deleteVocabularyDefinition(definitionId);
    await load();
  }

  /**
   * Removing the last meaning leaves an empty headword, which is not a word the
   * pueblo has any record of — so the author's delete takes the term with it.
   * Firestore rules permit that only at `definitionCount === 0`, and the count
   * is trigger-owned, so the reload above is what makes this reachable.
   */
  async function removeTerm() {
    if (!term) return;
    await deleteVocabularyTerm(term.id);
    router.back();
  }

  const isOwnTerm = Boolean(user && term && term.createdBy === user.uid);
  const canDeleteTerm =
    Boolean(term) && (canManage || (isOwnTerm && (term?.definitionCount ?? 0) === 0));

  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader
        title={t('village.vocabulary.title')}
        rightSlot={
          canDeleteTerm ? (
            <Pressable onPress={() => void removeTerm()} testID="vocabulary-delete-term">
              <Ionicons name="trash-outline" size={iconSizes.md} color={colors.light.fg.muted} />
            </Pressable>
          ) : null
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}>
          {!term ? (
            <Text tone="muted">{loading ? '' : t('village.vocabulary.notFound')}</Text>
          ) : (
            <>
              <VStack gap={1}>
                <ScreenTitle>{term.term}</ScreenTitle>
                <Text tone="muted" variant="bodySm">
                  {t(`village.vocabulary.kind.${term.kind}`)}
                </Text>
              </VStack>

              <EntityContributors
                userIds={term.contributorUserIds}
                orgIds={term.contributorOrgIds}
                label={t('village.contributors.label')}
              />

              <VStack gap={3}>
                <DetailSectionHeading>
                  {t('village.vocabulary.definitions', { count: definitions.length })}
                </DetailSectionHeading>
                {definitions.map((definition, index) => (
                  <View key={definition.id} className="border-b border-subtle pb-3">
                    <HStack gap={3} className="items-start">
                      <Text tone="muted" variant="bodySm">
                        {index + 1}.
                      </Text>
                      <VStack gap={1} className="flex-1">
                        <Text>{definition.definition}</Text>
                        {definition.example ? (
                          <Text tone="muted" variant="bodySm" className="italic">
                            “{definition.example}”
                          </Text>
                        ) : null}
                        {definition.castellano ? (
                          <Text tone="muted" variant="bodySm">
                            {t('village.vocabulary.castellano')}: {definition.castellano}
                          </Text>
                        ) : null}
                        <EntityContributors
                          variant="inline"
                          userIds={definition.contributorUserIds}
                          orgIds={definition.contributorOrgIds}
                          label={`${t('village.contributors.label')} · ${formatDate(definition.createdAt)}`}
                        />
                      </VStack>
                      {user ? (
                        <Pressable
                          onPress={() =>
                            definition.createdBy === user.uid || canManage
                              ? void removeDefinition(definition.id)
                              : setReportTarget({
                                  kind: 'vocabularyTerm',
                                  id: term.id,
                                  municipalityId: term.municipalityId,
                                  authorUserId: definition.createdBy,
                                })
                          }
                          testID={`vocabulary-definition-action-${definition.id}`}
                        >
                          <Ionicons
                            name={
                              definition.createdBy === user.uid || canManage
                                ? 'trash-outline'
                                : 'flag-outline'
                            }
                            size={iconSizes.sm}
                            color={colors.light.fg.muted}
                          />
                        </Pressable>
                      ) : null}
                    </HStack>
                  </View>
                ))}

                {isMember ? (
                  <Button
                    variant="secondary"
                    onPress={() =>
                      router.push(`/village/${villageId}/word/${term.id}/define` as never)
                    }
                    testID="vocabulary-add-definition"
                  >
                    {t('village.vocabulary.addDefinition')}
                  </Button>
                ) : null}
              </VStack>

              <OtherVillagesSaying
                normalized={term.normalized}
                municipalityId={term.municipalityId}
              />

              <EntityComments
                entityKind="vocabularyTerm"
                entityId={term.id}
                municipalityId={term.municipalityId}
                canModerate={canManage}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <ReportSheet
        visible={reportTarget != null}
        target={reportTarget}
        reporterUserId={user?.uid ?? ''}
        onClose={() => setReportTarget(null)}
      />
    </Screen>
  );
}

export default withVillageRoute(VocabularyTermScreen);
