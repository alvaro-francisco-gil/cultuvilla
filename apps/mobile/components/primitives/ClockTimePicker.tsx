import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';
import {
  clockPositions,
  hourRings,
  minuteTicks,
  setClockHour,
  setClockMinute,
} from '../../lib/date/clockGrid';

const pad2 = (n: number) => String(n).padStart(2, '0');

const SIZE = 260;
const CENTER = SIZE / 2;
const OUTER_R = 108;
const INNER_R = 70;
const TILE = 36;

export interface ClockTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  /** Fired after a minute is picked — the terminal action (parent closes here). */
  onCommit?: () => void;
  minuteStep?: number;
  testID?: string;
}

export function ClockTimePicker({ value, onChange, onCommit, minuteStep = 5, testID }: ClockTimePickerProps) {
  const [page, setPage] = useState<'hour' | 'minute'>('hour');
  const { outer, inner } = hourRings();
  const hour = value.getHours();
  const minute = value.getMinutes();

  function tile(v: number, x: number, y: number, kind: 'hour' | 'minute', selected: boolean) {
    return (
      <Pressable
        key={`${kind}-${v}`}
        testID={testID ? `${testID}-${kind}-${v}` : undefined}
        accessibilityRole="button"
        onPress={() => {
          if (kind === 'hour') {
            onChange(setClockHour(value, v));
            setPage('minute');
          } else {
            onChange(setClockMinute(value, v));
            onCommit?.();
          }
        }}
        style={[styles.tile, { left: CENTER + x - TILE / 2, top: CENTER + y - TILE / 2 }]}
        className={`items-center justify-center rounded-full ${selected ? 'bg-accent' : ''}`}
      >
        <Text tone={selected ? 'onAccent' : 'primary'}>{pad2(v)}</Text>
      </Pressable>
    );
  }

  return (
    <View testID={testID}>
      <View className="flex-row items-center justify-center" style={styles.readout}>
        <Pressable
          testID={testID ? `${testID}-show-hour` : undefined}
          accessibilityRole="button"
          onPress={() => setPage('hour')}
        >
          <Text variant="h3" tone={page === 'hour' ? 'primary' : 'muted'}>{pad2(hour)}</Text>
        </Pressable>
        <Text variant="h3">:</Text>
        <Pressable
          testID={testID ? `${testID}-show-minute` : undefined}
          accessibilityRole="button"
          onPress={() => setPage('minute')}
        >
          <Text variant="h3" tone={page === 'minute' ? 'primary' : 'muted'}>{pad2(minute)}</Text>
        </Pressable>
      </View>

      <View style={styles.face}>
        {page === 'hour'
          ? [
              ...clockPositions(outer, OUTER_R).map((p) => tile(p.value, p.x, p.y, 'hour', p.value === hour)),
              ...clockPositions(inner, INNER_R).map((p) => tile(p.value, p.x, p.y, 'hour', p.value === hour)),
            ]
          : clockPositions(minuteTicks(minuteStep), OUTER_R).map((p) =>
              tile(p.value, p.x, p.y, 'minute', p.value === minute),
            )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { gap: 4, paddingBottom: 12 },
  face: { width: SIZE, height: SIZE, alignSelf: 'center' },
  tile: { position: 'absolute', width: TILE, height: TILE },
});
