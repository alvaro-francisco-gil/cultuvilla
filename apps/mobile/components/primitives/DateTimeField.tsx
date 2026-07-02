import { useMemo, useState } from 'react';
import { FlatList, Modal, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@cultuvilla/shared/design-system';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { FieldLabel } from './FieldLabel';
import { Button } from './Button';

const ACCENT = colors.light.fg.accent;

export interface DateTimeFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Minute granularity for the time wheel. Defaults to 5. */
  minuteStep?: number;
  placeholder?: string;
  testID?: string;
}

type Segment = 'year' | 'month' | 'day' | 'hour' | 'minute';

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
const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Web-safe date + time picker. Mirrors the modal flow of the ordago-apps
 * DateTimePicker (a full-screen sheet with a Confirm action) but is built on
 * plain FlatLists instead of `@react-native-community/datetimepicker`, so it
 * renders identically on the villa-events web build. Colors follow the
 * cultuvilla accent.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  minuteStep = 5,
  placeholder,
  testID,
}: DateTimeFieldProps) {
  const today = new Date();
  const maxYear = (maximumDate ?? new Date(today.getFullYear() + 5, 11, 31)).getFullYear();
  const minYear = (minimumDate ?? today).getFullYear();

  const [open, setOpen] = useState(false);
  const [segment, setSegment] = useState<Segment | null>(null);
  // Draft edits live here until the user confirms.
  const [year, setYear] = useState<number | null>(value ? value.getFullYear() : null);
  const [month, setMonth] = useState<number | null>(value ? value.getMonth() : null);
  const [day, setDay] = useState<number | null>(value ? value.getDate() : null);
  const [hour, setHour] = useState<number | null>(value ? value.getHours() : null);
  const [minute, setMinute] = useState<number | null>(value ? value.getMinutes() : null);

  const yearOptions = useMemo(() => {
    const out: number[] = [];
    for (let y = minYear; y <= maxYear; y += 1) out.push(y);
    return out;
  }, [maxYear, minYear]);
  const monthOptions = useMemo(() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], []);
  const dayOptions = useMemo(() => {
    const cap = year != null && month != null ? daysInMonth(year, month) : 31;
    return Array.from({ length: cap }, (_, i) => i + 1);
  }, [year, month]);
  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minuteOptions = useMemo(
    () => Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep),
    [minuteStep],
  );

  function openModal() {
    // Seed empty drafts with sensible defaults so the sheet isn't blank.
    if (year == null) setYear(value?.getFullYear() ?? today.getFullYear());
    if (month == null) setMonth(value?.getMonth() ?? today.getMonth());
    if (day == null) setDay(value?.getDate() ?? today.getDate());
    if (hour == null) setHour(value?.getHours() ?? today.getHours());
    if (minute == null) {
      const m = value?.getMinutes() ?? 0;
      setMinute(Math.round(m / minuteStep) * minuteStep % 60);
    }
    setOpen(true);
  }

  const complete = year != null && month != null && day != null && hour != null && minute != null;

  function confirm() {
    if (year != null && month != null && day != null && hour != null && minute != null) {
      const cap = daysInMonth(year, month);
      onChange(new Date(year, month, Math.min(day, cap), hour, minute));
    }
    setSegment(null);
    setOpen(false);
  }

  const triggerText = value
    ? `${value.getDate()} ${MONTHS_ES_SHORT[value.getMonth()]} ${value.getFullYear()}, ${pad2(value.getHours())}:${pad2(value.getMinutes())}`
    : (placeholder ?? label);

  const segData: Record<Segment, { data: number[]; render: (n: number) => string }> = {
    year: { data: yearOptions, render: (n) => String(n) },
    month: { data: monthOptions, render: (n) => MONTHS_ES[n] ?? '' },
    day: { data: dayOptions, render: (n) => String(n) },
    hour: { data: hourOptions, render: (n) => pad2(n) },
    minute: { data: minuteOptions, render: (n) => pad2(n) },
  };
  const segSetter: Record<Segment, (n: number) => void> = {
    year: setYear, month: setMonth, day: setDay, hour: setHour, minute: setMinute,
  };
  const segTitle: Record<Segment, string> = {
    year: 'Año', month: 'Mes', day: 'Día', hour: 'Hora', minute: 'Minuto',
  };

  return (
    <View testID={testID}>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        onPress={openModal}
        accessibilityRole="button"
        testID={testID ? `${testID}-trigger` : undefined}
        style={styles.trigger}
      >
        <Text numberOfLines={1} tone={value ? 'primary' : 'muted'} style={styles.triggerText}>
          {triggerText}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={ACCENT} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text variant="h3">{label}</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityLabel="Cerrar" hitSlop={8}>
              <Ionicons name="close" size={24} color="#334155" />
            </Pressable>
          </View>

          <View style={styles.body}>
            <FieldLabel>Fecha</FieldLabel>
            <View style={styles.row}>
              <Seg text={day != null ? String(day) : 'Día'} onPress={() => setSegment('day')} />
              <Seg text={month != null ? (MONTHS_ES_SHORT[month] ?? 'Mes') : 'Mes'} onPress={() => setSegment('month')} />
              <Seg text={year != null ? String(year) : 'Año'} onPress={() => setSegment('year')} />
            </View>

            <FieldLabel>Hora</FieldLabel>
            <View style={styles.row}>
              <Seg text={hour != null ? pad2(hour) : 'HH'} onPress={() => setSegment('hour')} />
              <View style={styles.colon}><Text variant="h3">:</Text></View>
              <Seg text={minute != null ? pad2(minute) : 'MM'} onPress={() => setSegment('minute')} />
            </View>
          </View>

          <View style={styles.footer}>
            <Button variant="secondary" onPress={() => setOpen(false)}>Cancelar</Button>
            <View style={styles.footerConfirm}>
              <Button onPress={confirm} disabled={!complete} fullWidth>Confirmar</Button>
            </View>
          </View>

          {/* Per-segment option list, slides over the sheet. */}
          <Modal visible={segment != null} animationType="slide" transparent onRequestClose={() => setSegment(null)}>
            <View style={styles.pickerBackdrop}>
              <SafeAreaView style={styles.pickerSheet} edges={['bottom']}>
                <View style={styles.modalHeader}>
                  <Text variant="h3">{segment ? segTitle[segment] : ''}</Text>
                  <Pressable onPress={() => setSegment(null)} accessibilityLabel="Cerrar" hitSlop={8}>
                    <Ionicons name="close" size={24} color="#334155" />
                  </Pressable>
                </View>
                {segment && (
                  <FlatList
                    data={segData[segment].data}
                    keyExtractor={(n) => String(n)}
                    initialNumToRender={30}
                    renderItem={({ item }) => (
                      <Pressable
                        onPress={() => { segSetter[segment](item); setSegment(null); }}
                        style={styles.option}
                      >
                        <Text>{segData[segment].render(item)}</Text>
                      </Pressable>
                    )}
                  />
                )}
              </SafeAreaView>
            </View>
          </Modal>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function Seg({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.segment}>
      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.segmentText}>{text}</Text>
      <Ionicons name="chevron-down" size={16} color="#64748b" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 4,
    backgroundColor: '#ffffff',
  },
  triggerText: { flexShrink: 1, marginRight: 8 },
  modal: { flex: 1, padding: 16 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  body: { flex: 1, paddingTop: 16, gap: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 16, alignItems: 'center' },
  colon: { paddingHorizontal: 2 },
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
  segmentText: { flexShrink: 1, marginRight: 4 },
  footer: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingTop: 12 },
  footerConfirm: { flex: 1 },
  option: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  pickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  pickerSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: '70%',
  },
});
