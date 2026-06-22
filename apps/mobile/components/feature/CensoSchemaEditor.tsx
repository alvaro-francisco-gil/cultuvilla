import { useEffect, useReducer, useState } from 'react';
import { Alert } from 'react-native';
import { VStack, HStack, Text, Button, Pressable } from '../primitives';
import { useT } from '../../lib/i18n';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { updateCensoSchema } from '@cultuvilla/shared/services/censoService';
import { collectUsedValues } from '@cultuvilla/shared/services/membershipProfileService';
import { getVillageMembers } from '@cultuvilla/shared/services/villageMemberService';
import { listPredefinedFields } from '@cultuvilla/shared/models/municipality/profileFieldRegistry';
import type { FieldType } from '@cultuvilla/shared/models/municipality/CensoTypes';
import { censoEditorReducer, fieldErrors, type EditorAction } from './censo/censoEditorReducer';
import { QuestionCard } from './censo/QuestionCard';
import { QuestionTypePicker } from './censo/QuestionTypePicker';

/**
 * Organizer-only census authoring: add/remove/reorder fields and save the schema.
 * Fields already answered by members are "locked" (cannot be removed).
 * Content-only (no Screen/Header) so it can be embedded in the shared censo
 * screen behind a role check.
 */
export function CensoSchemaEditor({ villageId }: { villageId: string }) {
  const { t } = useT();
  const [fields, dispatch] = useReducer(censoEditorReducer, []);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [mun, members] = await Promise.all([
        getMunicipality(villageId),
        getVillageMembers(villageId),
      ]);
      const used = collectUsedValues(members);
      if (cancelled) return;
      setLocked(new Set(Object.entries(used).filter(([, v]) => v.size > 0).map(([k]) => k)));
      const initial = mun?.community?.profileForm?.fields ?? [];
      dispatch({ kind: 'reset', fields: initial });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [villageId]);

  const errors = fieldErrors(fields);
  const present = new Set(fields.map((f) => f.key));
  const available = listPredefinedFields().filter((d) => !present.has(d.key));

  async function save() {
    setSaveError(null);
    setSaving(true);
    try {
      await updateCensoSchema(villageId, fields);
      // mobile-web-compat: native-only — Alert is a no-op on web.
      Alert.alert(t('common.save'));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('censo.error'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Text className="p-4">{t('common.loading')}</Text>;

  return (
    <VStack gap={3} className="p-4">
      {fields.map((f, i) => (
        <QuestionCard
          key={`${f.key}-${i}`}
          field={f}
          index={i}
          dispatch={dispatch as (a: EditorAction) => void}
          locked={locked.has(f.key)}
          error={errors[i]}
        />
      ))}

      <Text variant="bodySm" tone="muted">{t('censo.builder.addQuestion')}</Text>
      <QuestionTypePicker onPick={(type: FieldType) => dispatch({ kind: 'addCustom', type })} />

      {available.length > 0 && (
        <>
          <Text variant="bodySm" tone="muted">{t('censo.builder.addPredefined')}</Text>
          <HStack gap={2} className="flex-wrap">
            {available.map((d) => (
              <Pressable
                key={d.key}
                onPress={() => dispatch({ kind: 'addPredefined', key: d.key })}
                className="px-3 py-2 rounded-full border border-subtle bg-surface"
              >
                <Text>{d.defaultLabel}</Text>
              </Pressable>
            ))}
          </HStack>
        </>
      )}

      {saveError !== null && <Text tone="danger">{saveError}</Text>}

      <Button onPress={save} loading={saving} disabled={Object.keys(errors).length > 0}>
        {t('common.save')}
      </Button>
    </VStack>
  );
}
