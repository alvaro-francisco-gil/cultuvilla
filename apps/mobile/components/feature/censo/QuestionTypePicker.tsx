import { ChoiceList } from './ChoiceList';
import type { FieldType } from '@cultuvilla/shared/models/municipality/CensoTypes';
import { useT } from '../../../lib/i18n';

const TYPES: FieldType[] = ['text', 'textarea', 'select', 'multiselect', 'number', 'boolean', 'date'];

export function QuestionTypePicker({ onPick }: { onPick: (type: FieldType) => void }) {
  const { t } = useT();
  return (
    <ChoiceList
      mode="single"
      value={undefined}
      onChange={(v) => onPick(v as FieldType)}
      options={TYPES.map((ty) => ({ value: ty, label: t(`censo.types.${ty}`) }))}
    />
  );
}
