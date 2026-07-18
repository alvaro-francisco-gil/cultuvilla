import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input, Toggle, Pressable, Text, VStack, HStack } from '../../primitives';
import { OptionsEditor } from './OptionsEditor';
import { QuestionTypeSheet, type SheetPick } from './QuestionTypeSheet';
import { resolveFieldDisplay } from '@cultuvilla/shared/services/censoFieldResolver';
import type { EditorAction } from './censoEditorReducer';
import type { OptionsSource, ProfileFormField } from '@cultuvilla/shared/models/municipality/CensoTypes';
import { useT } from '../../../lib/i18n';
import { ACCENT } from '../VillageSections';
import { showConfirm } from '../../../lib/dialogs';

const SOURCE_LABEL: Record<OptionsSource, string> = {
  barrios: 'censo.builder.sourceBarrios',
  places: 'censo.builder.sourcePlaces',
  organizations: 'censo.builder.sourceOrganizations',
  events: 'censo.builder.sourceEvents',
  festivalPosters: 'censo.builder.sourceFestivalPosters',
  news: 'censo.builder.sourceNews',
};

export function QuestionCard({
  field,
  index,
  dispatch,
  locked,
  answeredCount,
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
  answeredCount: number;
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
  const typeLabel = isEntity
    ? t(SOURCE_LABEL[r.optionsSource as OptionsSource])
    : t(`censo.types.${r.type}`);
  const subline = isEntity
    ? typeLabel
    : isChoice
      ? `${typeLabel} · ${t('censo.builder.optionsCount', { count: optionCount })}`
      : typeLabel;

  function handleRemove() {
    if (answeredCount > 0) {
      showConfirm(
        t('censo.builder.deleteAnsweredTitle'),
        t('censo.builder.deleteAnsweredBody', { count: answeredCount }),
        onRemove,
        { confirmText: t('common.delete') },
      );
      return;
    }
    onRemove();
  }

  // Translate a sheet pick into reducer actions. A generic choice type forces
  // static options via setOptions (which clears any optionsSource); an entity
  // pick ensures a choice type then sets the village source.
  function applyPick(pick: SheetPick) {
    if (pick.kind === 'entity') {
      if (!isChoice) dispatch({ kind: 'changeType', index, type: 'select' });
      dispatch({ kind: 'setSource', index, source: pick.source });
      return;
    }
    dispatch({ kind: 'changeType', index, type: pick.type });
    if (pick.type === 'select' || pick.type === 'multiselect') {
      const existing = field.source === 'custom' && field.optionsSource === undefined ? field.options ?? [] : [];
      dispatch({ kind: 'setOptions', index, options: existing });
    }
  }

  // ── Collapsed: compact, tappable summary ──────────────────────────────
  if (!active) {
    return (
      <Pressable
        onPress={onActivate}
        className="bg-surface-elevated border border-subtle rounded-xl p-4 shadow-sm"
      >
        <HStack gap={2} align="center">
          <Text tone="muted">{index + 1}.</Text>
          <View className="flex-1">
            <Text variant="body" numberOfLines={1}>{title}</Text>
            {error ? (
              <Text variant="bodySm" tone="danger" numberOfLines={1}>{t(`censo.builder.${error}`)}</Text>
            ) : (
              <Text variant="bodySm" tone="muted" numberOfLines={1}>{subline}</Text>
            )}
          </View>
          {r.required ? <Text style={{ color: ACCENT }}>*</Text> : null}
        </HStack>
      </Pressable>
    );
  }

  // ── Expanded: full editor with an accent left edge ────────────────────
  return (
    <View
      className="bg-surface-elevated border border-subtle rounded-xl p-4 shadow-sm"
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
          isEntity ? (
            !locked && (
              <Toggle
                label={t('censo.builder.allowMultiple')}
                value={r.type === 'multiselect'}
                onValueChange={(multi) =>
                  dispatch({ kind: 'changeType', index, type: multi ? 'multiselect' : 'select' })
                }
              />
            )
          ) : (
            field.source === 'custom' && (
              <OptionsEditor
                options={field.options ?? []}
                mode={r.type === 'multiselect' ? 'multi' : 'single'}
                onChange={(opts) => dispatch({ kind: 'setOptions', index, options: opts })}
              />
            )
          )
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
              ) : null}
              <Pressable
                onPress={handleRemove}
                accessibilityLabel={t('common.delete')}
                className="p-1"
              >
                <Ionicons name="trash-outline" size={20} color="#dc2626" />
              </Pressable>
            </HStack>
          </HStack>
        </View>
      </VStack>

      <QuestionTypeSheet
        visible={sheetOpen}
        current={isEntity ? { kind: 'entity', source: r.optionsSource as OptionsSource } : { kind: 'type', type: r.type }}
        onSelect={applyPick}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}
