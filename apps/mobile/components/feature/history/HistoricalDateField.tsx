import { View } from 'react-native';
import { monthShortLabels } from '@cultuvilla/shared/utils/format';
import { FieldLabel } from '../../primitives/FieldLabel';
import { HStack } from '../../primitives/HStack';
import { Input } from '../../primitives/Input';
import { Pressable } from '../../primitives/Pressable';
import { Text } from '../../primitives/Text';
import { Toggle } from '../../primitives/Toggle';
import { VStack } from '../../primitives/VStack';
import { useT } from '../../../lib/i18n';
import type { HistoricalDateDraft } from '../../../lib/history/historyForm';

const MONTHS = monthShortLabels();

function digitsOnly(text: string, max: number): string {
  return text.replace(/\D/g, '').slice(0, max);
}

/**
 * A date only as precise as what is known. The year is typed rather than
 * picked from a list — a scroll list from today back to the Romans is
 * thousands of rows — and the era is a toggle so nobody types a minus sign.
 * Month and day are optional; tapping the chosen month again clears it.
 */
export function HistoricalDateField({
  label,
  value,
  onChange,
  error,
  testID,
}: {
  label: string;
  value: HistoricalDateDraft;
  onChange: (next: HistoricalDateDraft) => void;
  error?: string;
  testID?: string;
}) {
  const { t } = useT();

  function pickMonth(month: number) {
    onChange(
      value.month === month ? { ...value, month: null, day: '' } : { ...value, month },
    );
  }

  return (
    <VStack gap={2} align="stretch" className="w-full">
      <FieldLabel>{label}</FieldLabel>
      <HStack gap={3} className="items-center">
        <View className="flex-1">
          <Input
            testID={testID ? `${testID}-year` : undefined}
            value={value.year}
            onChangeText={(text) => onChange({ ...value, year: digitsOnly(text, 4) })}
            placeholder={t('village.history.form.year')}
            keyboardType="number-pad"
            dense
          />
        </View>
        <Toggle
          testID={testID ? `${testID}-bc` : undefined}
          value={value.bc}
          onValueChange={(bc) => onChange({ ...value, bc })}
          label={t('village.history.form.bc')}
        />
      </HStack>
      <View className="flex-row flex-wrap" style={{ gap: 6 }}>
        {MONTHS.map((name, index) => {
          const month = index + 1;
          const selected = value.month === month;
          return (
            <Pressable
              key={name}
              testID={testID ? `${testID}-month-${String(month)}` : undefined}
              onPress={() => pickMonth(month)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`rounded-full px-3 py-1 border ${
                selected ? 'bg-accent border-accent' : 'bg-surface border-subtle'
              }`}
            >
              <Text variant="bodySm" tone={selected ? 'onAccent' : 'primary'}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {value.month != null ? (
        <View style={{ width: 96 }}>
          <Input
            testID={testID ? `${testID}-day` : undefined}
            value={value.day}
            onChangeText={(text) => onChange({ ...value, day: digitsOnly(text, 2) })}
            placeholder={t('village.history.form.day')}
            keyboardType="number-pad"
            dense
          />
        </View>
      ) : null}
      {error ? (
        <Text variant="bodySm" tone="danger">
          {error}
        </Text>
      ) : null}
    </VStack>
  );
}
