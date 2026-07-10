import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { VStack } from '../primitives/VStack';
import { Button } from '../primitives/Button';
import { Text } from '../primitives/Text';
import { useT } from '../../lib/i18n';
import { saveProfileAnswers } from '@cultuvilla/shared/services/membershipProfileService';
import { missingRequiredAnswers } from '@cultuvilla/shared/services/censoService';
import { resolveFieldDisplay } from '@cultuvilla/shared/services/censoFieldResolver';
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
 * Villager census responder, styled after a forms "respond" view: one card per
 * question (label as title, type-aware control below), then a save button.
 * Shows missing required fields as a warning before submit but does not block
 * saving — the server validates.
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

  // Show the "Censo guardado" confirmation briefly, then return to the village.
  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(
      () => router.replace({ pathname: '/village/[villageId]', params: { villageId } }),
      1000,
    );
    return () => clearTimeout(id);
  }, [saved, villageId]);

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
    return <Text tone="muted">{t('censo.noFields')}</Text>;
  }

  return (
    <VStack gap={3}>
      {schema.map((field) => {
        const r = resolveFieldDisplay(field);
        return (
          <View
            key={field.key}
            className="bg-surface-elevated border border-subtle rounded-xl p-4 shadow-sm"
          >
            <Text className="font-semibold mb-3">
              {r.label}
              {r.required ? <Text tone="danger"> *</Text> : null}
            </Text>
            <CensoFieldInput
              field={field}
              value={answers[field.key]}
              onChange={(v) => setAnswer(field.key, v)}
              entityOptions={entityOptionsByField?.[field.key]}
              showLabel={false}
            />
          </View>
        );
      })}

      {missingKeys.length > 0 && (
        <Text tone="danger">{t('censo.missingRequired')}</Text>
      )}

      {saved && <Text tone="success">{t('censo.saved')}</Text>}
      {error && <Text tone="danger">{error}</Text>}

      <Button onPress={onSubmit} loading={saving}>
        {t('censo.save')}
      </Button>
    </VStack>
  );
}
