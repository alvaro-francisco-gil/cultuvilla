import { FlatList, View } from 'react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';

const pad2 = (n: number) => String(n).padStart(2, '0');

export interface TimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  minuteStep?: number;
  testID?: string;
}

export function TimePicker({ value, onChange, minuteStep = 5, testID }: TimePickerProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);

  const setHour = (h: number) => {
    const d = new Date(value);
    d.setHours(h);
    d.setSeconds(0, 0);
    onChange(d);
  };
  const setMinute = (m: number) => {
    const d = new Date(value);
    d.setMinutes(m);
    d.setSeconds(0, 0);
    onChange(d);
  };

  return (
    <View className="flex-row" style={{ height: 180 }}>
      <FlatList
        style={{ flex: 1 }}
        data={hours}
        keyExtractor={(h) => String(h)}
        initialNumToRender={24}
        renderItem={({ item }) => (
          <Pressable testID={testID ? `${testID}-hour-${item}` : undefined} onPress={() => setHour(item)}>
            <Text tone={value.getHours() === item ? 'primary' : 'muted'}>{pad2(item)}</Text>
          </Pressable>
        )}
      />
      <FlatList
        style={{ flex: 1 }}
        data={minutes}
        keyExtractor={(m) => String(m)}
        initialNumToRender={minutes.length}
        renderItem={({ item }) => (
          <Pressable testID={testID ? `${testID}-minute-${item}` : undefined} onPress={() => setMinute(item)}>
            <Text tone={value.getMinutes() === item ? 'primary' : 'muted'}>{pad2(item)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
