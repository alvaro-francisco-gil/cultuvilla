import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, iconSizes } from '@cultuvilla/shared/design-system';
import { monthLongLabels } from '@cultuvilla/shared/utils/format';
import { useT } from '../../lib/i18n';
import { Button } from './Button';
import { FieldLabel } from './FieldLabel';
import { Pressable } from './Pressable';
import { Text } from './Text';

type Segment = 'year' | 'month' | 'day';

const MONTHS = monthLongLabels();
const CHEVRON_COLOR = colors.light.fg.muted;

export interface BirthDateFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  testID?: string;
}

function daysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

export function BirthDateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  testID,
}: BirthDateFieldProps) {
  const { t } = useT();
  const [year, setYear] = useState<number | null>(value?.getFullYear() ?? null);
  const [month, setMonth] = useState<number | null>(value?.getMonth() ?? null);
  const [day, setDay] = useState<number | null>(value?.getDate() ?? null);
  const [open, setOpen] = useState<Segment | null>(null);

  useEffect(() => {
    setYear(value?.getFullYear() ?? null);
    setMonth(value?.getMonth() ?? null);
    setDay(value?.getDate() ?? null);
  }, [value]);

  const maxYear = (maximumDate ?? new Date()).getFullYear();
  const minYear = (minimumDate ?? new Date(1900, 0, 1)).getFullYear();
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

  function commit(nextYear: number | null, nextMonth: number | null, nextDay: number | null) {
    if (nextYear == null || nextMonth == null || nextDay == null) {
      onChange(null);
      return;
    }
    const safeDay = Math.min(nextDay, daysInMonth(nextYear, nextMonth));
    onChange(new Date(nextYear, nextMonth, safeDay));
  }

  function pickYear(nextYear: number) {
    setYear(nextYear);
    setOpen(null);
    commit(nextYear, month, day);
  }

  function pickMonth(nextMonth: number) {
    setMonth(nextMonth);
    setOpen(null);
    commit(year, nextMonth, day);
  }

  function pickDay(nextDay: number) {
    setDay(nextDay);
    setOpen(null);
    commit(year, month, nextDay);
  }

  return (
    <View testID={testID}>
      <FieldLabel>{label}</FieldLabel>
      <View className="flex-row gap-2 mt-1">
        <SegmentButton
          text={year != null ? String(year) : t('profile.personForm.birthDatePicker.year')}
          onPress={() => setOpen('year')}
          testID={testID ? `${testID}-year` : undefined}
        />
        <SegmentButton
          text={
            month != null
              ? (MONTHS[month] ?? t('profile.personForm.birthDatePicker.month'))
              : t('profile.personForm.birthDatePicker.month')
          }
          onPress={() => setOpen('month')}
          testID={testID ? `${testID}-month` : undefined}
        />
        <SegmentButton
          text={day != null ? String(day) : t('profile.personForm.birthDatePicker.day')}
          onPress={() => setOpen('day')}
          testID={testID ? `${testID}-day` : undefined}
        />
      </View>

      <Modal visible={open != null} animationType="slide" onRequestClose={() => setOpen(null)}>
        <SafeAreaView
          edges={['top', 'bottom']}
          style={StyleSheet.absoluteFill}
          className="bg-surface p-4"
        >
          <View className="pb-3 border-b border-subtle">
            <Text variant="h3">
              {open ? t(`profile.personForm.birthDatePicker.${open}`) : ''}
            </Text>
          </View>
          {open === 'year' ? (
            <OptionList
              options={yearOptions}
              label={String}
              onPick={pickYear}
              testID={testID ? `${testID}-year-option` : undefined}
            />
          ) : null}
          {open === 'month' ? (
            <OptionList
              options={monthOptions}
              label={(option) => MONTHS[option] ?? String(option + 1)}
              onPick={pickMonth}
              testID={testID ? `${testID}-month-option` : undefined}
            />
          ) : null}
          {open === 'day' ? (
            <OptionList
              options={dayOptions}
              label={String}
              onPick={pickDay}
              testID={testID ? `${testID}-day-option` : undefined}
            />
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
        <Pressable
          onPress={() => onPick(item)}
          className="px-4 py-3.5 border-b border-subtle"
          testID={testID ? `${testID}-${item}` : undefined}
        >
          <Text>{label(item)}</Text>
        </Pressable>
      )}
    />
  );
}
