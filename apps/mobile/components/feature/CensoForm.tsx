import { useState } from 'react';
import { VStack } from '../primitives/VStack';
import { Button } from '../primitives/Button';
import { Text } from '../primitives/Text';
import { useT } from '../../lib/i18n';
import { saveProfileAnswers } from '@cultuvilla/shared/services/membershipProfileService';
import { missingRequiredAnswers } from '@cultuvilla/shared/services/censoService';
import type { ProfileFormField, ProfileAnswers, ProfileAnswerValue } from '@cultuvilla/shared/models/municipality/CensoTypes';
import { CensoFieldInput } from './censo/CensoFieldInput';
import type { ChoiceOption } from './censo/ChoiceList';

export type CensoFormProps = {
  villageId: string;
  userId: string;
  schema: ProfileFormField[];
  initialAnswers?: ProfileAnswers;
  entityOptionsByField?: Record<string, ChoiceOption[]>;
};

/**
 * V1 censo form: renders a plain text Input for every field in the schema,
 * regardless of field type. Proper type-based widgets (select, multiselect,
 * boolean, etc.) are v2. Shows missing required fields as a warning before
 * submit but does not block saving — the server validates.
 */
export function CensoForm({ villageId, userId, schema, initialAnswers, entityOptionsByField }: CensoFormProps) {
  const { t } = useT();
  const [answers, setAnswers] = useState<ProfileAnswers>(initialAnswers ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setAnswer(key: string, value: ProfileAnswerValue | undefined) {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[key]; else next[key] = value;
      return next;
    });
    setSaved(false);
  }

  const missingKeys = missingRequiredAnswers(schema, answers);

  async function onSubmit() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await saveProfileAnswers(villageId, userId, schema, answers);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('censo.error'));
    } finally {
      setSaving(false);
    }
  }

  if (schema.length === 0) {
    return (
      <Text tone="muted">{t('censo.noFields')}</Text>
    );
  }

  return (
    <VStack gap={4}>
      {schema.map((field) => (
        <CensoFieldInput
          key={field.key}
          field={field}
          value={answers[field.key]}
          onChange={(v) => setAnswer(field.key, v)}
          entityOptions={entityOptionsByField?.[field.key]}
        />
      ))}

      {missingKeys.length > 0 && (
        <Text tone="danger">
          {t('censo.missingRequired')}: {missingKeys.join(', ')}
        </Text>
      )}

      {saved && <Text tone="success">{t('censo.saved')}</Text>}
      {error && <Text tone="danger">{error}</Text>}

      <Button onPress={onSubmit} loading={saving}>
        {t('censo.save')}
      </Button>
    </VStack>
  );
}
