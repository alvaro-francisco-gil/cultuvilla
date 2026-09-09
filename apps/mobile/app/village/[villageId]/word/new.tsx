import { useState } from 'react';
import { Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../../components/primitives/Screen';
import { VStack } from '../../../../components/primitives/VStack';
import { HStack } from '../../../../components/primitives/HStack';
import { Text } from '../../../../components/primitives/Text';
import { Input } from '../../../../components/primitives/Input';
import { Button } from '../../../../components/primitives/Button';
import { Pressable } from '../../../../components/primitives/Pressable';
import { FieldLabel } from '../../../../components/primitives/FieldLabel';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';
import { addVocabularyEntry } from '@cultuvilla/shared/services/vocabularyService';
import {
  VOCABULARY_TERM_KINDS,
  type VocabularyTermKind,
} from '@cultuvilla/shared/models/vocabulary';

/**
 * "Añadir palabra" — the headword and its first meaning in one submit.
 *
 * The two halves land in different collections, and the term is keyed by its
 * own slug, so submitting a word somebody already added simply attaches your
 * meaning to theirs rather than failing or forking the entry.
 */
export default function NewVocabularyTermScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const { uid, isMember } = useEntityCapabilities(villageId);

  const [term, setTerm] = useState('');
  const [kind, setKind] = useState<VocabularyTermKind>('palabra');
  const [definition, setDefinition] = useState('');
  const [example, setExample] = useState('');
  const [castellano, setCastellano] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = Boolean(term.trim() && definition.trim() && uid && isMember && !saving);

  async function submit() {
    if (!villageId || !uid || !canSubmit) return;
    setSaving(true);
    try {
      const termId = await addVocabularyEntry({
        municipalityId: villageId,
        term,
        kind,
        createdBy: uid,
        definition,
        example,
        castellano,
      });
      router.replace(`/village/${villageId}/word/${termId}` as never);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title={t('village.vocabulary.add')} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label={t('village.vocabulary.term')}
            value={term}
            onChangeText={setTerm}
            placeholder={t('village.vocabulary.termPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={80}
            testID="vocabulary-term-input"
          />

          <VStack gap={2}>
            <FieldLabel>{t('village.vocabulary.kindLabel')}</FieldLabel>
            <HStack gap={2} className="flex-wrap">
              {VOCABULARY_TERM_KINDS.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setKind(option)}
                  className={`px-3 py-2 rounded-md border ${
                    kind === option ? 'bg-accent border-accent' : 'border-subtle'
                  }`}
                  testID={`vocabulary-kind-${option}`}
                >
                  <Text variant="bodySm" tone={kind === option ? 'onAccent' : 'primary'}>
                    {t(`village.vocabulary.kind.${option}`)}
                  </Text>
                </Pressable>
              ))}
            </HStack>
          </VStack>

          <Input
            label={t('village.vocabulary.definition')}
            value={definition}
            onChangeText={setDefinition}
            placeholder={t('village.vocabulary.definitionPlaceholder')}
            multiline
            autoGrow
            maxLength={1000}
            testID="vocabulary-definition-input"
          />
          <Input
            label={t('village.vocabulary.example')}
            value={example}
            onChangeText={setExample}
            placeholder={t('village.vocabulary.examplePlaceholder')}
            multiline
            autoGrow
            maxLength={500}
            testID="vocabulary-example-input"
          />
          <Input
            label={t('village.vocabulary.castellano')}
            value={castellano}
            onChangeText={setCastellano}
            placeholder={t('village.vocabulary.castellanoPlaceholder')}
            maxLength={200}
            testID="vocabulary-castellano-input"
          />

          <Button
            onPress={() => void submit()}
            disabled={!canSubmit}
            loading={saving}
            fullWidth
            testID="vocabulary-submit"
          >
            {t('village.vocabulary.save')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
