import { useState, type ComponentType } from 'react';
import { FlatList, Modal, Platform, View, StyleSheet } from 'react-native';
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
  /** Minute granularity for the web time wheel. Defaults to 5. */
  minuteStep?: number;
  placeholder?: string;
  testID?: string;
}

type Mode = 'date' | 'time';

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MONTHS_ES_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];
const pad2 = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (year: number, monthZeroBased: number) => new Date(year, monthZeroBased + 1, 0).getDate();

function formatLong(d: Date): string {
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}
function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Date + time picker mirroring the ordago-apps DateTimePicker: a modal card with
 * a "Fecha" row and an "Hora" row that open the native calendar / clock. On
 * iOS/Android it uses `@react-native-community/datetimepicker` (calendar for the
 * date, clock for the time); on the web build — where that native module isn't
 * available — it falls back to plain wheel lists. Colors follow the app accent.
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
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [draft, setDraft] = useState<Date>(value ?? defaultDraft(minimumDate));

  // Lazy-require the native module so the web bundle (and jest) never load it.
  const RNDateTimePicker =
    Platform.OS !== 'web'
      ? (require('@react-native-community/datetimepicker').default as ComponentType<{
          value: Date;
          mode: Mode;
          is24Hour?: boolean;
          display?: string;
          minimumDate?: Date;
          maximumDate?: Date;
          onChange: (event: unknown, date?: Date) => void;
        }>)
      : null;

  function openModal() {
    setDraft(value ?? defaultDraft(minimumDate));
    setMode(null);
    setOpen(true);
  }

  // Merge a picked value so changing the date keeps the time and vice versa.
  function applyPicked(picked: Date, which: Mode) {
    setDraft((prev) => {
      const merged = new Date(prev);
      if (which === 'date') merged.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
      else merged.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
      return merged;
    });
  }

  function onNativeChange(_event: unknown, picked?: Date) {
    if (Platform.OS === 'android') setMode(null); // Android shows its own dialog
    if (picked) applyPicked(picked, mode ?? 'date');
  }

  function confirm() {
    onChange(draft);
    setMode(null);
    setOpen(false);
  }

  const triggerText = value
    ? `${formatLong(value)} · ${formatTime(value)}`
    : (placeholder ?? label);

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

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text variant="h3">{label}</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityLabel="Cerrar" hitSlop={8}>
                <Ionicons name="close" size={24} color="#334155" />
              </Pressable>
            </View>

            <SelectionRow
              icon="calendar-outline"
              label="Fecha"
              value={formatLong(draft)}
              active={mode === 'date'}
              onPress={() => setMode('date')}
            />
            <SelectionRow
              icon="time-outline"
              label="Hora"
              value={formatTime(draft)}
              active={mode === 'time'}
              onPress={() => setMode('time')}
            />

            {/* Picker surface — native calendar/clock, or web wheels. */}
            {mode && Platform.OS === 'web' ? (
              <WebWheels
                mode={mode}
                value={draft}
                minuteStep={minuteStep}
                minYear={(minimumDate ?? new Date()).getFullYear()}
                maxYear={(maximumDate ?? new Date(draft.getFullYear() + 5, 11, 31)).getFullYear()}
                onPick={(d) => applyPicked(d, mode)}
              />
            ) : null}
            {mode && RNDateTimePicker ? (
              <RNDateTimePicker
                value={draft}
                mode={mode}
                is24Hour
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={onNativeChange}
              />
            ) : null}

            <View style={styles.footer}>
              <Button variant="secondary" onPress={() => setOpen(false)}>Cancelar</Button>
              <View style={styles.footerConfirm}>
                <Button onPress={confirm} fullWidth>Confirmar</Button>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function defaultDraft(minimumDate?: Date): Date {
  const base = minimumDate && minimumDate.getTime() > Date.now() ? new Date(minimumDate) : new Date();
  base.setSeconds(0, 0);
  return base;
}

function SelectionRow({
  icon,
  label,
  value,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.selRow, active && styles.selRowActive]}>
      <Ionicons name={icon} size={22} color={ACCENT} />
      <View style={styles.selText}>
        <Text variant="caption" tone="muted">{label}</Text>
        <Text style={styles.selValue}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
    </Pressable>
  );
}

/** Web-only fallback: simple wheel columns since the native picker has no web build. */
function WebWheels({
  mode,
  value,
  minuteStep,
  minYear,
  maxYear,
  onPick,
}: {
  mode: Mode;
  value: Date;
  minuteStep: number;
  minYear: number;
  maxYear: number;
  onPick: (d: Date) => void;
}) {
  const cols: { data: number[]; render: (n: number) => string; get: () => number; set: (n: number) => Date }[] =
    mode === 'date'
      ? [
          {
            data: Array.from({ length: daysInMonth(value.getFullYear(), value.getMonth()) }, (_, i) => i + 1),
            render: (n) => String(n),
            get: () => value.getDate(),
            set: (n) => { const d = new Date(value); d.setDate(n); return d; },
          },
          {
            data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            render: (n) => MONTHS_ES_SHORT[n] ?? '',
            get: () => value.getMonth(),
            set: (n) => { const d = new Date(value); d.setMonth(n); return d; },
          },
          {
            data: Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i),
            render: (n) => String(n),
            get: () => value.getFullYear(),
            set: (n) => { const d = new Date(value); d.setFullYear(n); return d; },
          },
        ]
      : [
          {
            data: Array.from({ length: 24 }, (_, i) => i),
            render: (n) => pad2(n),
            get: () => value.getHours(),
            set: (n) => { const d = new Date(value); d.setHours(n); return d; },
          },
          {
            data: Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep),
            render: (n) => pad2(n),
            get: () => value.getMinutes(),
            set: (n) => { const d = new Date(value); d.setMinutes(n); return d; },
          },
        ];
  return (
    <View style={styles.wheels}>
      {cols.map((col, ci) => (
        <FlatList
          key={ci}
          style={styles.wheelCol}
          data={col.data}
          keyExtractor={(n) => String(n)}
          initialNumToRender={20}
          renderItem={({ item }) => {
            const isSel = col.get() === item;
            return (
              <Pressable onPress={() => onPick(col.set(item))} style={styles.wheelItem}>
                <Text tone={isSel ? 'primary' : 'muted'} style={isSel ? styles.wheelItemSel : undefined}>
                  {col.render(item)}
                </Text>
              </Pressable>
            );
          }}
        />
      ))}
    </View>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f8fafc',
  },
  selRowActive: { borderColor: ACCENT },
  selText: { flex: 1 },
  selValue: { fontSize: 16, fontWeight: '600', textTransform: 'capitalize' },
  footer: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingTop: 4 },
  footerConfirm: { flex: 1 },
  wheels: { flexDirection: 'row', gap: 8, height: 180 },
  wheelCol: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8 },
  wheelItem: { paddingVertical: 10, alignItems: 'center' },
  wheelItemSel: { fontWeight: '700' },
});
