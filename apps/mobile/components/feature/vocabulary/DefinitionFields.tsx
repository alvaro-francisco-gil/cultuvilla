import { Input } from '../../primitives/Input';
import { useT } from '../../../lib/i18n';

export interface DefinitionDraft {
  definition: string;
  example: string;
  castellano: string;
}

export const EMPTY_DEFINITION_DRAFT: DefinitionDraft = { definition: '', example: '', castellano: '' };

/**
 * The three fields of one meaning. Shared by "añadir palabra" (the word and its
 * first meaning) and "añadir significado" (another meaning for a word that
 * already exists), so both forms ask for exactly the same thing.
 */
export function DefinitionFields({
  value,
  onChange,
}: {
  value: DefinitionDraft;
  onChange: (next: DefinitionDraft) => void;
}) {
  const { t } = useT();
  return (
    <>
      <Input
        label={t('village.vocabulary.definition')}
        value={value.definition}
        onChangeText={(definition) => onChange({ ...value, definition })}
        placeholder={t('village.vocabulary.definitionPlaceholder')}
        multiline
        autoGrow
        maxLength={1000}
        testID="vocabulary-definition-input"
      />
      <Input
        label={t('village.vocabulary.example')}
        value={value.example}
        onChangeText={(example) => onChange({ ...value, example })}
        placeholder={t('village.vocabulary.examplePlaceholder')}
        multiline
        autoGrow
        maxLength={500}
        testID="vocabulary-example-input"
      />
      <Input
        label={t('village.vocabulary.castellano')}
        value={value.castellano}
        onChangeText={(castellano) => onChange({ ...value, castellano })}
        placeholder={t('village.vocabulary.castellanoPlaceholder')}
        maxLength={200}
        testID="vocabulary-castellano-input"
      />
    </>
  );
}
