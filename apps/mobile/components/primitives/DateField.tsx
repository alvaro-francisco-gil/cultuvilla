import { useMemo, useState } from 'react';
import { FlatList, Modal, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { FieldLabel } from './FieldLabel';
import { Button } from './Button';

export interface DateFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  testID?: string;
}

type Segment = 'year' | 'month' | 'day';

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const MONTHS_ES_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function daysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  testID,
}: DateFieldProps) {
  const today = new Date();
  const maxYear = (maximumDate ?? today).getFullYear();
  const minYear = (minimumDate ?? new Date(1900, 0, 1)).getFullYear();

  const [year, setYear] = useState<number | null>(value ? value.getFullYear() : null);
  const [month, setMonth] = useState<number | null>(value ? value.getMonth() : null);
  const [day, setDay] = useState<number | null>(value ? value.getDate() : null);
  const [open, setOpen] = useState<Segment | null>(null);

  const yearOptions = useMemo(() => {
    const out: number[] = [];
    for (let y = maxYear; y >= minYear; y -= 1) out.push(y);
    return out;
  }, [maxYear, minYear]);

  const monthOptions = useMemo(() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], []);

  const dayOptions = useMemo(() => {
    const cap = year != null && month != null ? daysInMonth(year, month) : 31;
    return Array.from({ length: cap }, (_, i) => i + 1);
  }, [year, month]);

  function commit(nextYear: number | null, nextMonth: number | null, nextDay: number | null) {
    if (nextYear != null && nextMonth != null && nextDay != null) {
      const cap = daysInMonth(nextYear, nextMonth);
      const safeDay = Math.min(nextDay, cap);
      onChange(new Date(nextYear, nextMonth, safeDay));
    } else {
      onChange(null);
    }
  }

  function pickYear(y: number) {
    setYear(y);
    setOpen(null);
    commit(y, month, day);
  }
  function pickMonth(m: number) {
    setMonth(m);
    setOpen(null);
    commit(year, m, day);
  }
  function pickDay(d: number) {
    setDay(d);
    setOpen(null);
    commit(year, month, d);
  }

  const yearLabel = year != null ? String(year) : 'Año';
  const monthLabel = month != null ? (MONTHS_ES_SHORT[month] ?? 'Mes') : 'Mes';
  const dayLabel = day != null ? String(day) : 'Día';

  return (
    <View testID={testID}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.row}>
        <SegmentButton text={yearLabel} onPress={() => setOpen('year')} testID={testID ? `${testID}-year` : undefined} />
        <SegmentButton text={monthLabel} onPress={() => setOpen('month')} testID={testID ? `${testID}-month` : undefined} />
        <SegmentButton text={dayLabel} onPress={() => setOpen('day')} testID={testID ? `${testID}-day` : undefined} />
      </View>

      <Modal visible={open != null} animationType="slide" onRequestClose={() => setOpen(null)}>
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text variant="h3">
              {open === 'year' ? 'Año' : open === 'month' ? 'Mes' : 'Día'}
            </Text>
          </View>
          {open === 'year' && (
            <FlatList
              data={yearOptions}
              keyExtractor={(y) => String(y)}
              initialNumToRender={40}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => pickYear(item)}
                  style={styles.option}
                  testID={testID ? `${testID}-year-option-${item}` : undefined}
                >
                  <Text>{String(item)}</Text>
                </Pressable>
              )}
            />
          )}
          {open === 'month' && (
            <FlatList
              data={monthOptions}
              keyExtractor={(m) => String(m)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => pickMonth(item)}
                  style={styles.option}
                  testID={testID ? `${testID}-month-option-${item}` : undefined}
                >
                  <Text>{MONTHS_ES[item] ?? ''}</Text>
                </Pressable>
              )}
            />
          )}
          {open === 'day' && (
            <FlatList
              data={dayOptions}
              keyExtractor={(d) => String(d)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => pickDay(item)}
                  style={styles.option}
                  testID={testID ? `${testID}-day-option-${item}` : undefined}
                >
                  <Text>{String(item)}</Text>
                </Pressable>
              )}
            />
          )}
          <View style={styles.modalActions}>
            <Button variant="secondary" onPress={() => setOpen(null)}>
              Cancelar
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
      style={styles.segment}
    >
      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.segmentText}>
        {text}
      </Text>
      <Ionicons name="chevron-down" size={16} color="#64748b" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    minWidth: 0,
  },
  segmentText: {
    flexShrink: 1,
    marginRight: 4,
  },
  modal: { flex: 1, padding: 16 },
  modalHeader: { paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  option: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  modalActions: { paddingTop: 12, flexDirection: 'row', justifyContent: 'flex-end' },
});
