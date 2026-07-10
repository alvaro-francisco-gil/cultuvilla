import { useState } from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDate } from '@cultuvilla/shared/utils/format';
import { colors } from '@cultuvilla/shared/design-system';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { FieldLabel } from './FieldLabel';
import { Button } from './Button';
import { CalendarDatePicker } from './CalendarDatePicker';
import { TimePicker } from './TimePicker';

const ACCENT = colors.light.fg.accent;

export interface DateTimeFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Minute granularity for the time picker. Defaults to 5. */
  minuteStep?: number;
  placeholder?: string;
  testID?: string;
}

type ActiveModal = 'date' | 'time' | null;

function defaultDraft(minimumDate?: Date): Date {
  const base = minimumDate && minimumDate.getTime() > Date.now() ? new Date(minimumDate) : new Date();
  base.setSeconds(0, 0);
  return base;
}

/**
 * Date + time picker: two side-by-side buttons (date, time), each opening its
 * own full-screen modal — the calendar grid for the date, the hour/minute
 * wheels for the time. Picking a date preserves the current time and vice
 * versa, so the two buttons always compose onto the same underlying value.
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
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const current = value ?? defaultDraft(minimumDate);

  function pickDate(day: Date) {
    const merged = new Date(current);
    merged.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    onChange(merged);
    setActiveModal(null);
  }

  function pickTime(time: Date) {
    onChange(time);
    setActiveModal(null);
  }

  const dateText = value ? formatDate(value, 'dayMonth') : (placeholder ?? 'Fecha');
  const timeText = value ? formatDate(value, 'time') : (placeholder ?? 'Hora');

  return (
    <View testID={testID}>
      <FieldLabel>{label}</FieldLabel>
      <View className="flex-row gap-3" style={styles.row}>
        <Pressable
          onPress={() => setActiveModal('date')}
          accessibilityRole="button"
          testID={testID ? `${testID}-date` : undefined}
          className="flex-1"
          style={[styles.trigger, { flex: 1 }]}
        >
          <Ionicons name="calendar-outline" size={18} color={ACCENT} />
          <Text numberOfLines={1} tone={value ? 'primary' : 'muted'} style={styles.triggerText}>
            {dateText}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveModal('time')}
          accessibilityRole="button"
          testID={testID ? `${testID}-time` : undefined}
          className="flex-1"
          style={[styles.trigger, { flex: 1 }]}
        >
          <Ionicons name="time-outline" size={18} color={ACCENT} />
          <Text numberOfLines={1} tone={value ? 'primary' : 'muted'} style={styles.triggerText}>
            {timeText}
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={activeModal === 'date'}
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text variant="h3">{label}</Text>
          </View>
          <CalendarDatePicker
            testID={testID ? `${testID}-date-calendar` : undefined}
            value={current}
            onChange={pickDate}
            minDate={minimumDate}
            maxDate={maximumDate}
          />
          <View style={styles.modalActions}>
            <Button variant="secondary" onPress={() => setActiveModal(null)}>
              Cancelar
            </Button>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={activeModal === 'time'}
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text variant="h3">{label}</Text>
          </View>
          <TimePicker
            testID={testID ? `${testID}-time-picker` : undefined}
            value={current}
            onChange={pickTime}
            minuteStep={minuteStep}
          />
          <View style={styles.modalActions}>
            <Button variant="secondary" onPress={() => setActiveModal(null)}>
              Cancelar
            </Button>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 4 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  triggerText: { flexShrink: 1 },
  modal: { flex: 1, padding: 16 },
  modalHeader: { paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  modalActions: { paddingTop: 12, flexDirection: 'row', justifyContent: 'flex-end' },
});
