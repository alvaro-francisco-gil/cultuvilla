import { ChoiceList } from './ChoiceList';
import type { OptionsSource } from '@cultuvilla/shared/models/municipality/CensoTypes';
import { useT } from '../../../lib/i18n';

const SOURCES: OptionsSource[] = ['barrios', 'places', 'organizations'];

const LABEL: Record<OptionsSource, string> = {
  barrios: 'censo.builder.sourceBarrios',
  places: 'censo.builder.sourcePlaces',
  organizations: 'censo.builder.sourceOrganizations',
};

export function EntitySourcePicker({
  value,
  onPick,
}: {
  value?: OptionsSource;
  onPick: (s: OptionsSource) => void;
}) {
  const { t } = useT();
  return (
    <ChoiceList
      mode="single"
      value={value}
      onChange={(v) => onPick(v as OptionsSource)}
      options={SOURCES.map((s) => ({ value: s, label: t(LABEL[s]) }))}
    />
  );
}
