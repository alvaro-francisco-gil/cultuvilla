import { Input, Toggle, DateField, Text, VStack } from '../../primitives';
import { ChoiceList, type ChoiceOption } from './ChoiceList';
import { useT } from '../../../lib/i18n';
import { resolveFieldDisplay } from '@cultuvilla/shared/services/censoFieldResolver';
import type { ProfileFormField, ProfileAnswerValue } from '@cultuvilla/shared/models/municipality/CensoTypes';

export interface CensoFieldInputProps {
  field: ProfileFormField;
  value: ProfileAnswerValue | undefined;
  onChange: (next: ProfileAnswerValue | undefined) => void;
  entityOptions?: ChoiceOption[];
  /** Render the field's own label. Off when a surrounding card supplies the question title. */
  showLabel?: boolean;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CensoFieldInput({ field, value, onChange, entityOptions, showLabel = true }: CensoFieldInputProps) {
  const { t } = useT();
  const r = resolveFieldDisplay(field);
  const fullLabel = r.label + (r.required ? ' *' : '');
  const label = showLabel ? fullLabel : undefined;

  switch (r.type) {
    case 'textarea':
      return <Input label={label} value={String(value ?? '')} onChangeText={(v) => onChange(v)} multiline numberOfLines={2} dense />;
    case 'number':
      return (
        <Input
          label={label}
          dense
          keyboardType="numeric"
          value={value === undefined || value === null ? '' : String(value)}
          onChangeText={(v) => {
            const n = Number(v);
            onChange(v.trim() === '' || Number.isNaN(n) ? undefined : n);
          }}
        />
      );
    case 'boolean':
      return (
        <VStack gap={1}>
          {showLabel && <Text variant="bodySm" tone="muted">{fullLabel}</Text>}
          <Toggle value={value === true} onValueChange={(b) => onChange(b)} />
        </VStack>
      );
    case 'date': {
      // Parse YYYY-MM-DD as local midnight (T00:00:00) to match toISODate's local-time getters,
      // preventing round-trip day shifts in negative-UTC timezones.
      const d = typeof value === 'string' && value ? new Date(value + 'T00:00:00') : null;
      return <DateField label={label ?? ''} value={d} onChange={(nd) => onChange(nd ? toISODate(nd) : undefined)} />;
    }
    case 'select':
    case 'multiselect': {
      const baseOptions: ChoiceOption[] = r.optionsSource
        ? (entityOptions ?? [])
        : (r.options ?? []).map((o) => ({ value: o, label: o }));
      // Surface a stored value that no longer maps to a live option (deleted entity).
      const known = new Set(baseOptions.map((o) => o.value));
      const stored = Array.isArray(value) ? value : value !== undefined ? [String(value)] : [];
      const ghosts: ChoiceOption[] = stored
        .filter((sv) => !known.has(sv))
        .map((sv) => ({ value: sv, label: t('censo.builder.deletedEntity'), disabled: true }));
      return (
        <VStack gap={1}>
          {showLabel && <Text variant="bodySm" tone="muted">{fullLabel}</Text>}
          <ChoiceList
            options={[...baseOptions, ...ghosts]}
            mode={r.type === 'multiselect' ? 'multi' : 'single'}
            value={value as string | string[] | undefined}
            onChange={(next) => onChange(next)}
          />
        </VStack>
      );
    }
    case 'text':
    default:
      return <Input label={label} value={String(value ?? '')} onChangeText={(v) => onChange(v)} dense />;
  }
}
