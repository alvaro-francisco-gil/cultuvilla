import { useCallback, useState } from 'react';
import { Platform, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { iconSizes, colors } from '@cultuvilla/shared/design-system';
import { Screen } from '../../../../components/primitives/Screen';
import { Text } from '../../../../components/primitives/Text';
import { HStack } from '../../../../components/primitives/HStack';
import { VStack } from '../../../../components/primitives/VStack';
import { Input } from '../../../../components/primitives/Input';
import { Button } from '../../../../components/primitives/Button';
import { Pressable } from '../../../../components/primitives/Pressable';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { ScreenTitle } from '../../../../components/primitives/ScreenTitle';
import { DetailSectionHeading } from '../../../../components/feature/DetailSectionHeading';
import { EntityComments } from '../../../../components/feature/EntityComments';
import { ReportSheet, type ReportTarget } from '../../../../components/feature/ReportSheet';
import { useT } from '../../../../lib/i18n';
import { useAuth } from '../../../../lib/auth/useAuth';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';
import {
  addVocabularyDefinition,
  deleteVocabularyDefinition,
  deleteVocabularyTerm,
  getVocabularyDefinitions,
  getVocabularyTerm,
  type VocabularyDefinitionWithId,
  type VocabularyTermWithId,
} from '@cultuvilla/shared/services/vocabularyService';
import { recordEntityView } from '@cultuvilla/shared/services/commentsService';
import { formatDate } from '@cultuvilla/shared/utils';

/**
 * One headword and every meaning the pueblo has given it.
 *
 * Deliberately NOT an `EntityDetailScaffold` consumer: a word has no hero image
 * and no card scroll, so it is a plain `ScreenHeader` screen. It does carry
 * comments, which is why `vocabularyTerm` is in `ENTITY_KINDS` — that list is
 * "comment-capable kinds", not the hero-detail entity family.
 */
export default function VocabularyTermScreen() {
  const { villageId, termId } = useLocalSearchParams<{ villageId: string; termId: string }>();
  const { t } = useT();
  const { user } = useAuth();
  const { canManage, isMember } = useEntityCapabilities(villageId);

  const [term, setTerm] = useState<VocabularyTermWithId | null>(null);
  const [definitions, setDefinitions] = useState<VocabularyDefinitionWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftExample, setDraftExample] = useState('');
  const [saving, setSaving] = useState(false);
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

  async function submitDefinition() {
    if (!term || !user || !draft.trim()) return;
    setSaving(true);
    try {
      await addVocabularyDefinition({
        municipalityId: term.municipalityId,
        termId: term.id,
        definition: draft,
        example: draftExample,
        castellano: null,
        createdBy: user.uid,
      });
      setDraft('');
      setDraftExample('');
      setAdding(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

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
                        <Text tone="muted" variant="bodySm">
                          {formatDate(definition.createdAt)}
                        </Text>
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
                  adding ? (
                    <VStack gap={3}>
                      <Input
                        value={draft}
                        onChangeText={setDraft}
                        placeholder={t('village.vocabulary.definitionPlaceholder')}
                        multiline
                        autoGrow
                        maxLength={1000}
                        testID="vocabulary-definition-draft"
                      />
                      <Input
                        value={draftExample}
                        onChangeText={setDraftExample}
                        placeholder={t('village.vocabulary.examplePlaceholder')}
                        multiline
                        autoGrow
                        maxLength={500}
                        testID="vocabulary-example-draft"
                      />
                      <HStack gap={2}>
                        <Button
                          onPress={() => void submitDefinition()}
                          disabled={!draft.trim() || saving}
                          loading={saving}
                          testID="vocabulary-definition-save"
                        >
                          {t('village.vocabulary.save')}
                        </Button>
                        <Button variant="secondary" onPress={() => setAdding(false)}>
                          {t('common.cancel')}
                        </Button>
                      </HStack>
                    </VStack>
                  ) : (
                    <Button
                      variant="secondary"
                      onPress={() => setAdding(true)}
                      testID="vocabulary-add-definition"
                    >
                      {t('village.vocabulary.addDefinition')}
                    </Button>
                  )
                ) : null}
              </VStack>

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
