import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input, Toggle, Pressable, Text, VStack, HStack } from '../../primitives';
import { OptionsEditor } from './OptionsEditor';
import { EntitySourcePicker } from './EntitySourcePicker';
import { QuestionTypeSheet, type BuilderTypeChoice } from './QuestionTypeSheet';
import { resolveFieldDisplay } from '@cultuvilla/shared/services/censoFieldResolver';
import type { EditorAction } from './censoEditorReducer';
import type { OptionsSource, ProfileFormField } from '@cultuvilla/shared/models/municipality/CensoTypes';
import { useT } from '../../../lib/i18n';
import { ACCENT } from '../VillageSections';

const SOURCE_LABEL: Record<OptionsSource, string> = {
  barrios: 'censo.builder.sourceBarrios',
  places: 'censo.builder.sourcePlaces',
  organizations: 'censo.builder.sourceOrganizations',
};

export function QuestionCard({
  field,
  index,
  dispatch,
  locked,
  error,
  active,
  onActivate,
  onMove,
  onRemove,
}: {
  field: ProfileFormField;
  index: number;
  dispatch: (a: EditorAction) => void;
  locked: boolean;
  error?: string;
  active: boolean;
  onActivate: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const [sheetOpen, setSheetOpen] = useState(false);
  const r = resolveFieldDisplay(field);
  const isCustom = field.source === 'custom';
  const isChoice = r.type === 'select' || r.type === 'multiselect';
  const isEntity = isChoice && r.optionsSource !== undefined;
  const optionCount = field.source === 'custom' ? field.options?.length ?? 0 : 0;

  const title = r.label.trim() || t('censo.builder.untitledQuestion');
  const typeLabel = isEntity ? t('censo.types.entity') : t(`censo.types.${r.type}`);
  const subline = isEntity
    ? `${typeLabel} · ${t(SOURCE_LABEL[r.optionsSource as OptionsSource])}`
    : isChoice
      ? `${typeLabel} · ${t('censo.builder.optionsCount', { count: optionCount })}`
      : typeLabel;

  // Translate a type-sheet pick into reducer actions. Picking a manual choice
  // (select/multiselect) forces static options via setOptions (which clears any
  // optionsSource); picking "entity" sets a village source; everything else is
  // a plain type change.
  function applyTypeChoice(choice: BuilderTypeChoice) {
    if (choice === 'entity') {
      if (!isChoice) dispatch({ kind: 'changeType', index, type: 'select' });
      const current = field.source === 'custom' ? field.optionsSource : undefined;
      dispatch({ kind: 'setSource', index, source: current ?? 'barrios' });
      return;
    }
    dispatch({ kind: 'changeType', index, type: choice });
    if (choice === 'select' || choice === 'multiselect') {
      const existing = field.source === 'custom' && field.optionsSource === undefined ? field.options ?? [] : [];
      dispatch({ kind: 'setOptions', index, options: existing });
    }
  }

  // ── Collapsed: compact, tappable summary ──────────────────────────────
  if (!active) {
    return (
      <Pressable
        onPress={onActivate}
        className="bg-surface border border-subtle rounded-xl p-4"
      >
        <HStack gap={2} align="center">
          <Text tone="muted">{index + 1}.</Text>
          <View className="flex-1">
            <Text variant="body" numberOfLines={1}>{title}</Text>
            <Text variant="bodySm" tone="muted" numberOfLines={1}>{subline}</Text>
          </View>
          {r.required ? <Text style={{ color: ACCENT }}>*</Text> : null}
        </HStack>
      </Pressable>
    );
  }

  // ── Expanded: full editor with an accent left edge ────────────────────
  return (
    <View
      className="bg-surface border border-subtle rounded-xl p-4"
      style={{ borderLeftColor: ACCENT, borderLeftWidth: 4 }}
    >
      <VStack gap={3}>
        {isCustom ? (
          <Input
            value={r.label}
            onChangeText={(v) => dispatch({ kind: 'setLabel', index, label: v })}
            placeholder={t('censo.builder.emptyLabel')}
          />
        ) : (
          <Text variant="body">{r.label}</Text>
        )}

        {/* Type selector — opens the bottom sheet. Predefined/locked fields
            can't change type, so they show it read-only. */}
        {isCustom && !locked ? (
          <Pressable
            onPress={() => setSheetOpen(true)}
            className="border border-subtle rounded-lg px-3 py-2"
          >
            <HStack gap={2} align="center" justify="between">
              <Text>{typeLabel}</Text>
              <Ionicons name="chevron-down" size={18} color="#6b7280" />
            </HStack>
          </Pressable>
        ) : (
          <Text variant="bodySm" tone="muted">{typeLabel}</Text>
        )}

        {/* Choice configuration */}
        {isCustom && isChoice && (
          <VStack gap={2}>
            {isEntity ? (
              <>
                <Text variant="bodySm" tone="muted">{t('censo.builder.source')}</Text>
                <EntitySourcePicker
                  value={field.source === 'custom' ? field.optionsSource : undefined}
                  onPick={(s) => dispatch({ kind: 'setSource', index, source: s })}
                />
                {!locked && (
                  <Toggle
                    label={t('censo.builder.allowMultiple')}
                    value={r.type === 'multiselect'}
                    onValueChange={(multi) =>
                      dispatch({ kind: 'changeType', index, type: multi ? 'multiselect' : 'select' })
                    }
                  />
                )}
              </>
            ) : (
              field.source === 'custom' && (
                <OptionsEditor
                  options={field.options ?? []}
                  mode={r.type === 'multiselect' ? 'multi' : 'single'}
                  onChange={(opts) => dispatch({ kind: 'setOptions', index, options: opts })}
                />
              )
            )}
          </VStack>
        )}

        {error ? <Text tone="danger">{t(`censo.builder.${error}`)}</Text> : null}

        {/* Footer */}
        <View className="border-t border-subtle pt-3">
          <HStack gap={3} align="center" justify="between">
            <Toggle
              label={t('censo.builder.required')}
              value={r.required}
              onValueChange={(b) => dispatch({ kind: 'setRequired', index, required: b })}
            />
            <HStack gap={3} align="center">
              <Pressable
                onPress={() => onMove(-1)}
                accessibilityLabel={t('censo.builder.moveUp')}
                className="p-1"
              >
                <Ionicons name="arrow-up" size={20} color="#6b7280" />
              </Pressable>
              <Pressable
                onPress={() => onMove(1)}
                accessibilityLabel={t('censo.builder.moveDown')}
                className="p-1"
              >
                <Ionicons name="arrow-down" size={20} color="#6b7280" />
              </Pressable>
              {locked ? (
                <Text variant="bodySm" className="text-orange-600">{t('censo.builder.locked')}</Text>
              ) : (
                <Pressable
                  onPress={onRemove}
                  accessibilityLabel={t('common.delete')}
                  className="p-1"
                >
                  <Ionicons name="trash-outline" size={20} color="#dc2626" />
                </Pressable>
              )}
            </HStack>
          </HStack>
        </View>
      </VStack>

      <QuestionTypeSheet
        visible={sheetOpen}
        current={isEntity ? 'entity' : r.type}
        onPick={applyTypeChoice}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}
