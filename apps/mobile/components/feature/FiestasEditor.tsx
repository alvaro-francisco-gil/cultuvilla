import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  buildFiestaBlock,
  clampAnchor,
  fiestaBlockId,
  resolveFiestaWindow,
  type FiestaBlock,
} from '@cultuvilla/shared/models';
import { iconSizes } from '@cultuvilla/shared/design-system';
import { formatDate } from '@cultuvilla/shared/utils/format';
import { HStack, Input, Pressable, Text, Toggle, VStack, DateField, Button } from '../primitives';
import { useT } from '../../lib/i18n';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

interface Props {
  blocks: FiestaBlock[];
  year: number;
  onChange: (next: FiestaBlock[]) => void;
}

/**
 * Declare when a village's fiestas are. Each block carries a recurring anchor
 * (which answers "when are the fiestas?" for any year with no admin action) and
 * optionally an exact window for a given year.
 *
 * Confirming a year materializes the anchor into real dates the admin can then
 * adjust — a movable block that tracks a weekend drifts from its anchor, and
 * only the exact window is allowed to feed a published Wrapped.
 */
export function FiestasEditor({ blocks, year, onChange }: Props) {
  const { t } = useT();
  const [draftName, setDraftName] = useState('');

  const ids = useMemo(() => blocks.map((b) => b.id), [blocks]);

  const replace = useCallback(
    (id: string, next: FiestaBlock) => onChange(blocks.map((b) => (b.id === id ? next : b))),
    [blocks, onChange],
  );

  function add() {
    const name = draftName.trim();
    if (name === '') return;
    onChange([
      ...blocks,
      buildFiestaBlock({ id: fiestaBlockId(name, ids), name, anchor: { month: 8, day: 15, days: 3 } }),
    ]);
    setDraftName('');
  }

  function remove(id: string) {
    onChange(blocks.filter((b) => b.id !== id));
  }

  function setAnchor(block: FiestaBlock, patch: Partial<FiestaBlock['anchor']>) {
    replace(block.id, { ...block, anchor: clampAnchor({ ...block.anchor, ...patch }) });
  }

  /** Materialize the anchor into an editable exact window, or drop it. */
  function setConfirmed(block: FiestaBlock, confirmed: boolean) {
    const years = { ...block.years };
    if (!confirmed) delete years[String(year)];
    else {
      const w = resolveFiestaWindow(block, year);
      if (w) years[String(year)] = { start: w.start, end: w.end };
    }
    replace(block.id, { ...block, years });
  }

  function setWindowEdge(block: FiestaBlock, edge: 'start' | 'end', date: Date | null) {
    const current = block.years[String(year)];
    if (!current || !date) return;
    const next = { ...current, [edge]: date };
    if (next.end.getTime() < next.start.getTime()) return;
    replace(block.id, { ...block, years: { ...block.years, [String(year)]: next } });
  }

  return (
    <VStack gap={3}>
      <Text variant="h3" className="mt-2">
        {t('village.fiestas.title')}
      </Text>
      <Text variant="caption" className="text-secondary">
        {t('village.fiestas.help')}
      </Text>

      {blocks.map((block) => {
        const exact = block.years[String(year)] ?? null;
        return (
          <View key={block.id} className="rounded-md border border-subtle p-3">
            <VStack gap={2}>
              <HStack className="items-center justify-between">
                <Input
                  value={block.name}
                  onChangeText={(name) => replace(block.id, { ...block, name })}
                  placeholder={t('village.fiestas.namePlaceholder')}
                  className="flex-1"
                />
                <Pressable
                  onPress={() => remove(block.id)}
                  accessibilityLabel={t('village.fiestas.remove')}
                  testID={`fiesta-remove-${block.id}`}
                  className="ml-2"
                >
                  <Ionicons name="trash-outline" size={iconSizes.md} />
                </Pressable>
              </HStack>

              <Text variant="caption" className="text-secondary">
                {t('village.fiestas.anchorLabel')}
              </Text>
              <HStack gap={1} className="flex-wrap">
                {MONTHS.map((label, i) => (
                  <Pressable
                    key={label}
                    onPress={() => setAnchor(block, { month: i + 1 })}
                    testID={`fiesta-${block.id}-month-${i + 1}`}
                    className={`rounded-sm px-2 py-1 ${block.anchor.month === i + 1 ? 'bg-primary' : 'bg-surface-elevated'}`}
                  >
                    <Text variant="caption" className={block.anchor.month === i + 1 ? 'text-on-primary' : ''}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </HStack>
              <HStack gap={2}>
                <Stepper
                  label={t('village.fiestas.day')}
                  value={block.anchor.day}
                  onChange={(day) => setAnchor(block, { day })}
                  testID={`fiesta-${block.id}-day`}
                />
                <Stepper
                  label={t('village.fiestas.days')}
                  value={block.anchor.days}
                  onChange={(days) => setAnchor(block, { days })}
                  testID={`fiesta-${block.id}-days`}
                />
              </HStack>

              <HStack className="mt-1 items-center justify-between">
                <Text variant="caption" className="flex-1 text-secondary">
                  {t('village.fiestas.confirmYear', { year: String(year) })}
                </Text>
                <Toggle
                  value={exact !== null}
                  onValueChange={(v) => setConfirmed(block, v)}
                  testID={`fiesta-${block.id}-confirm`}
                />
              </HStack>

              {exact ? (
                <VStack gap={2}>
                  <DateField
                    label={t('village.fiestas.startsAt')}
                    value={exact.start}
                    onChange={(d) => setWindowEdge(block, 'start', d)}
                    testID={`fiesta-${block.id}-start`}
                  />
                  <DateField
                    label={t('village.fiestas.endsAt')}
                    value={exact.end}
                    onChange={(d) => setWindowEdge(block, 'end', d)}
                    testID={`fiesta-${block.id}-end`}
                  />
                </VStack>
              ) : (
                <Text variant="caption" className="text-secondary">
                  {t('village.fiestas.approximate', {
                    dates: describeApproximate(block, year),
                  })}
                </Text>
              )}
            </VStack>
          </View>
        );
      })}

      <HStack gap={2} className="items-center">
        <Input
          value={draftName}
          onChangeText={setDraftName}
          placeholder={t('village.fiestas.namePlaceholder')}
          className="flex-1"
          testID="fiesta-new-name"
        />
        <Button onPress={add} disabled={draftName.trim() === ''} testID="fiesta-add">
          {t('village.fiestas.add')}
        </Button>
      </HStack>
    </VStack>
  );
}

function describeApproximate(block: FiestaBlock, year: number): string {
  const w = resolveFiestaWindow(block, year);
  if (!w) return '';
  return `${formatDate(w.start, 'short')} – ${formatDate(w.end, 'short')}`;
}

function Stepper({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  testID: string;
}) {
  return (
    <VStack gap={1} className="flex-1">
      <Text variant="caption" className="text-secondary">
        {label}
      </Text>
      <HStack className="items-center justify-between rounded-sm border border-subtle px-2 py-1">
        <Pressable onPress={() => onChange(value - 1)} testID={`${testID}-minus`} accessibilityLabel="-">
          <Ionicons name="remove" size={iconSizes.sm} />
        </Pressable>
        <Text testID={testID}>{value}</Text>
        <Pressable onPress={() => onChange(value + 1)} testID={`${testID}-plus`} accessibilityLabel="+">
          <Ionicons name="add" size={iconSizes.sm} />
        </Pressable>
      </HStack>
    </VStack>
  );
}
