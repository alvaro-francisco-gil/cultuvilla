import { View } from 'react-native';
import type { FiestaBlock } from '@cultuvilla/shared/models';
import { Button, DateRangeField, HStack, Text, Toggle, VStack } from '../../primitives';
import { useT } from '../../../lib/i18n';
import { effectiveRange, wrappedFormRequest, type WrappedFormState } from '../../../lib/wrapped/wrappedForm';
import type { WrappedRequest } from '@cultuvilla/shared/wrapped';

interface Props {
  municipalityId: string;
  year: number;
  today: string;
  fiestas: FiestaBlock[];
  state: WrappedFormState;
  onChange: (next: WrappedFormState) => void;
  onSubmit: (request: WrappedRequest) => void;
  submitting: boolean;
  submitLabel: string;
}

/**
 * Pick the days each of this year's fiestas ran, and the range everything is
 * counted over. The range follows the fiestas until the admin picks one — to
 * take in, say, the articles written the week before.
 */
export function WrappedCreateForm({
  municipalityId,
  year,
  today,
  fiestas,
  state,
  onChange,
  onSubmit,
  submitting,
  submitLabel,
}: Props) {
  const { t } = useT();
  const minDay = `${String(year)}-01-01`;
  const maxDay = today < `${String(year)}-12-31` ? today : `${String(year)}-12-31`;
  const result = wrappedFormRequest(state, { municipalityId, year, today, fiestas });
  const range = effectiveRange(state);

  const setBlock = (blockId: string, patch: Partial<WrappedFormState['blocks'][number]>) =>
    onChange({ ...state, blocks: state.blocks.map((b) => (b.blockId === blockId ? { ...b, ...patch } : b)) });

  return (
    <VStack gap={4}>
      <Text variant="caption" tone="muted">
        {t('village.wrapped.formHelp')}
      </Text>

      {state.blocks.map((b) => (
        <View key={b.blockId} className="rounded-md border border-subtle p-3">
          <VStack gap={2}>
            <HStack align="center" justify="between">
              <Text variant="h3">{b.name}</Text>
              <Toggle
                value={b.enabled}
                onValueChange={(enabled) => setBlock(b.blockId, { enabled })}
                testID={`wrapped-block-${b.blockId}-enabled`}
              />
            </HStack>
            {b.enabled ? (
              <DateRangeField
                label={t('village.wrapped.blockDates')}
                value={b.range}
                onChange={(r) => setBlock(b.blockId, { range: r })}
                initialMonth={new Date(year, b.month - 1, 1)}
                minDay={minDay}
                maxDay={maxDay}
                testID={`wrapped-block-${b.blockId}-range`}
              />
            ) : (
              <Text variant="caption" tone="muted">
                {t('village.wrapped.blockSkipped')}
              </Text>
            )}
          </VStack>
        </View>
      ))}

      <VStack gap={1}>
        <DateRangeField
          label={t('village.wrapped.range')}
          value={range}
          onChange={(r) => onChange({ ...state, customRange: r })}
          initialMonth={range ? undefined : new Date(year, 6, 1)}
          minDay={minDay}
          maxDay={maxDay}
          placeholder={t('village.wrapped.rangePlaceholder')}
          testID="wrapped-range"
        />
        <Text variant="caption" tone="muted">
          {state.customRange ? t('village.wrapped.rangeCustomHelp') : t('village.wrapped.rangeHelp')}
        </Text>
        {state.customRange ? (
          <Button variant="ghost" onPress={() => onChange({ ...state, customRange: null })} testID="wrapped-range-reset">
            {t('village.wrapped.rangeReset')}
          </Button>
        ) : null}
      </VStack>

      {!result.ok && result.problem !== 'missing-dates' ? (
        <Text tone="danger" testID="wrapped-problem">
          {t(`village.wrapped.problem.${result.problem}`)}
        </Text>
      ) : null}

      <Button
        onPress={() => {
          if (result.ok) onSubmit(result.request);
        }}
        disabled={!result.ok || submitting}
        loading={submitting}
        fullWidth
        testID="wrapped-submit"
      >
        {submitLabel}
      </Button>
      {submitting ? (
        <Text variant="caption" tone="muted" className="text-center">
          {t('village.wrapped.building')}
        </Text>
      ) : null}
    </VStack>
  );
}
