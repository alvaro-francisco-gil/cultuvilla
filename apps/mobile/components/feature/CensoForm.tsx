import { useState } from 'react';
import { VStack } from '../primitives/VStack';
import { Input } from '../primitives/Input';
import { Button } from '../primitives/Button';
import { Text } from '../primitives/Text';
import { useT } from '../../lib/i18n';
import { saveProfileAnswers } from '@cultuvilla/shared/services/membershipProfileService';
import { missingRequiredAnswers } from '@cultuvilla/shared/services/censoService';
import type { ProfileFormField, ProfileAnswers } from '@cultuvilla/shared/models/municipality/CensoTypes';

export type CensoFormProps = {
  villageId: string;
  userId: string;
  schema: ProfileFormField[];
  initialAnswers?: ProfileAnswers;
};

/**
 * V1 censo form: renders a plain text Input for every field in the schema,
 * regardless of field type. Proper type-based widgets (select, multiselect,
 * boolean, etc.) are v2. Shows missing required fields as a warning before
 * submit but does not block saving — the server validates.
 */
export function CensoForm({ villageId, userId, schema, initialAnswers }: CensoFormProps) {
  const { t } = useT();
  const [answers, setAnswers] = useState<ProfileAnswers>(initialAnswers ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setAnswer(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
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
      {schema.map((field) => {
        const label = field.source === 'custom' ? field.label : field.key;
        const value = String(answers[field.key] ?? '');
        return (
          <Input
            key={field.key}
            label={label}
            value={value}
            onChangeText={(v) => setAnswer(field.key, v)}
          />
        );
      })}

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
