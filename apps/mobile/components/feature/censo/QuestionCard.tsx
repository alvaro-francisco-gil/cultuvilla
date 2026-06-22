import { Input, Toggle, Pressable, Text, VStack, HStack } from '../../primitives';
import { QuestionTypePicker } from './QuestionTypePicker';
import { OptionsEditor } from './OptionsEditor';
import { EntitySourcePicker } from './EntitySourcePicker';
import { resolveFieldDisplay } from '@cultuvilla/shared/services/censoFieldResolver';
import type { EditorAction } from './censoEditorReducer';
import type { ProfileFormField } from '@cultuvilla/shared/models/municipality/CensoTypes';
import { useT } from '../../../lib/i18n';

export function QuestionCard({
  field,
  index,
  dispatch,
  locked,
  error,
}: {
  field: ProfileFormField;
  index: number;
  dispatch: (a: EditorAction) => void;
  locked: boolean;
  error?: string;
}) {
  const { t } = useT();
  const r = resolveFieldDisplay(field);
  const isCustom = field.source === 'custom';
  const isChoice = r.type === 'select' || r.type === 'multiselect';

  return (
    <VStack gap={2} className="bg-surface border border-subtle rounded-xl p-3">
      {isCustom ? (
        <Input
          label={t('censo.builder.questionLabel')}
          value={r.label}
          onChangeText={(v) => dispatch({ kind: 'setLabel', index, label: v })}
          placeholder={t('censo.builder.emptyLabel')}
        />
      ) : (
        <Text>{r.label}</Text>
      )}

      {isCustom && !locked && (
        <QuestionTypePicker onPick={(type) => dispatch({ kind: 'changeType', index, type })} />
      )}

      {isCustom && isChoice && (
        <VStack gap={2}>
          <Text variant="bodySm" tone="muted">
            {t('censo.builder.source')}
          </Text>
          <EntitySourcePicker
            value={field.source === 'custom' ? field.optionsSource : undefined}
            onPick={(s) => dispatch({ kind: 'setSource', index, source: s })}
          />
          {field.source === 'custom' && field.optionsSource === undefined && (
            <OptionsEditor
              options={field.options ?? []}
              onChange={(opts) => dispatch({ kind: 'setOptions', index, options: opts })}
            />
          )}
        </VStack>
      )}

      <HStack gap={3} align="center" justify="between">
        <Toggle
          label={t('censo.builder.required')}
          value={r.required}
          onValueChange={(b) => dispatch({ kind: 'setRequired', index, required: b })}
        />
        <HStack gap={2} align="center">
          <Pressable onPress={() => dispatch({ kind: 'move', index, dir: -1 })}>
            <Text>{'↑'}</Text>
          </Pressable>
          <Pressable onPress={() => dispatch({ kind: 'move', index, dir: 1 })}>
            <Text>{'↓'}</Text>
          </Pressable>
          {locked ? (
            <Text className="text-xs text-orange-600">{t('censo.builder.locked')}</Text>
          ) : (
            <Pressable onPress={() => dispatch({ kind: 'remove', index })}>
              <Text className="text-red-600">{t('common.delete')}</Text>
            </Pressable>
          )}
        </HStack>
      </HStack>

      {error ? <Text tone="danger">{t(`censo.builder.${error}`)}</Text> : null}
    </VStack>
  );
}
