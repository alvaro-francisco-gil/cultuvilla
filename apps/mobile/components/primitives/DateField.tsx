import { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface DateFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  testID?: string;
}

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = 'DD/MM/AAAA',
  minimumDate,
  maximumDate,
  testID,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS !== 'ios') setOpen(false);
    if (event.type === 'dismissed') return;
    if (selected) onChange(selected);
  }

  return (
    <View testID={testID}>
      <Text tone="muted">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        testID={testID ? `${testID}-trigger` : undefined}
      >
        <Text>{value ? formatDate(value) : placeholder}</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={value ?? maximumDate ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
}
