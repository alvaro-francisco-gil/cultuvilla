import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, iconSizes } from '@cultuvilla/shared/design-system';
import { monthLongLabels } from '@cultuvilla/shared/utils/format';
import type { PartialDate } from '@cultuvilla/shared/models/person';
import { useT } from '../../lib/i18n';
import { Button } from './Button';
import { FieldLabel } from './FieldLabel';
import { Pressable } from './Pressable';
import { Text } from './Text';

type Segment = 'year' | 'month' | 'day';

const MONTHS = monthLongLabels();
const CHEVRON_COLOR = colors.light.fg.muted;

export interface PartialDateFieldProps {
  label: string;
  value: PartialDate | null;
  onChange: (value: PartialDate | null) => void;
  minYear?: number;
  maxYear?: number;
  showClearAction?: boolean;
  testID?: string;
}

function daysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

export function PartialDateField({
  label,
  value,
  onChange,
  minYear = 1900,
  maxYear = new Date().getFullYear(),
  showClearAction = true,
  testID,
}: PartialDateFieldProps) {
  const { t } = useT();
  // month kept 0-based internally (like BirthDateField); emitted 1-based.
  const [year, setYear] = useState<number | null>(value?.year ?? null);
  const [month, setMonth] = useState<number | null>(value?.month != null ? value.month - 1 : null);
  const [day, setDay] = useState<number | null>(value?.day ?? null);
  const [open, setOpen] = useState<Segment | null>(null);

  useEffect(() => {
    setYear(value?.year ?? null);
    setMonth(value?.month != null ? value.month - 1 : null);
    setDay(value?.day ?? null);
  }, [value]);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let option = maxYear; option >= minYear; option -= 1) years.push(option);
    return years;
  }, [maxYear, minYear]);
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => index), []);
  const dayOptions = useMemo(() => {
    const count = year != null && month != null ? daysInMonth(year, month) : 31;
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [year, month]);

  // Emit rule: no year → null. Otherwise a partial with 1-based month.
  function commit(nextYear: number | null, nextMonth: number | null, nextDay: number | null) {
    if (nextYear == null) {
      onChange(null);
      return;
    }
    const safeDay =
      nextMonth != null && nextDay != null ? Math.min(nextDay, daysInMonth(nextYear, nextMonth)) : nextDay;
    onChange({ year: nextYear, month: nextMonth != null ? nextMonth + 1 : null, day: safeDay });
  }

  function pickYear(next: number) {
    setYear(next);
    setOpen(null);
    commit(next, month, day);
  }
  function pickMonth(next: number) {
    setMonth(next);
    setOpen(null);
    commit(year, next, day);
  }
  function pickDay(next: number) {
    setDay(next);
    setOpen(null);
    commit(year, month, next);
  }
  function clear() {
    setYear(null);
    setMonth(null);
    setDay(null);
    setOpen(null);
    onChange(null);
  }

  return (
    <View testID={testID}>
      <View className="flex-row items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        {showClearAction && year != null ? (
          <Pressable onPress={clear} testID={testID ? `${testID}-clear` : undefined} accessibilityRole="button">
            <Text tone="muted" variant="bodySm">
              {t('partialDate.clear')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View className="flex-row gap-2 mt-1">
        <SegmentButton
          text={year != null ? String(year) : t('partialDate.year')}
          onPress={() => setOpen('year')}
          testID={testID ? `${testID}-year` : undefined}
        />
        <SegmentButton
          text={month != null ? (MONTHS[month] ?? t('partialDate.month')) : t('partialDate.month')}
          onPress={() => setOpen('month')}
          testID={testID ? `${testID}-month` : undefined}
        />
        <SegmentButton
          text={day != null ? String(day) : t('partialDate.day')}
          onPress={() => setOpen('day')}
          testID={testID ? `${testID}-day` : undefined}
        />
      </View>

      <Modal visible={open != null} animationType="slide" onRequestClose={() => setOpen(null)}>
        <SafeAreaView edges={['top', 'bottom']} style={StyleSheet.absoluteFill} className="bg-surface p-4">
          <View className="px-6 pt-4 pb-5 border-b border-subtle">
            <Text variant="h2" className="text-accent">
              {open ? t(`partialDate.${open}`) : ''}
            </Text>
          </View>
          {open === 'year' ? (
            <OptionList options={yearOptions} label={String} onPick={pickYear} testID={testID ? `${testID}-year-option` : undefined} />
          ) : null}
          {open === 'month' ? (
            <OptionList options={monthOptions} label={(o) => MONTHS[o] ?? String(o + 1)} onPick={pickMonth} testID={testID ? `${testID}-month-option` : undefined} />
          ) : null}
          {open === 'day' ? (
            <OptionList options={dayOptions} label={String} onPick={pickDay} testID={testID ? `${testID}-day-option` : undefined} />
          ) : null}
          <View className="pt-3 flex-row justify-end">
            <Button variant="secondary" onPress={() => setOpen(null)}>
              {t('common.cancel')}
            </Button>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function SegmentButton({ text, onPress, testID }: { text: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      className="flex-1 min-w-0 flex-row items-center justify-between border border-subtle rounded-md py-3 px-2 bg-surface"
    >
      <Text numberOfLines={1} ellipsizeMode="tail" className="shrink mr-1">
        {text}
      </Text>
      <Ionicons name="chevron-down" size={iconSizes.sm} color={CHEVRON_COLOR} />
    </Pressable>
  );
}

function OptionList({
  options,
  label,
  onPick,
  testID,
}: {
  options: number[];
  label: (option: number) => string;
  onPick: (option: number) => void;
  testID?: string;
}) {
  return (
    <FlatList
      className="flex-1"
      data={options}
      keyExtractor={String}
      initialNumToRender={40}
      renderItem={({ item }) => (
        <Pressable onPress={() => onPick(item)} className="px-6 py-4 border-b border-subtle" testID={testID ? `${testID}-${item}` : undefined}>
          <Text>{label(item)}</Text>
        </Pressable>
      )}
    />
  );
}
