import { TypeSheet, type TypeSheetSection } from '../questions/TypeSheet';
import type { FieldType, OptionsSource } from '@cultuvilla/shared/models/municipality/CensoTypes';

/**
 * A pick from the type sheet: either a generic question type, or a village
 * element (an entity-backed choice on a specific source).
 */
export type SheetPick =
  | { kind: 'type'; type: FieldType }
  | { kind: 'entity'; source: OptionsSource };

// Row ids are `type:<FieldType>` / `entity:<OptionsSource>` so one flat string
// addresses both halves of the union in the shared sheet.
function rowId(pick: SheetPick): string {
  return pick.kind === 'type' ? `type:${pick.type}` : `entity:${pick.source}`;
}

function parseRowId(id: string): SheetPick {
  const [kind, value] = id.split(':');
  return kind === 'entity'
    ? { kind: 'entity', source: value as OptionsSource }
    : { kind: 'type', type: value as FieldType };
}

const SECTIONS: TypeSheetSection[] = [
  {
    rows: [
      { id: 'type:text', labelKey: 'censo.types.text', icon: 'text-outline' },
      { id: 'type:textarea', labelKey: 'censo.types.textarea', icon: 'menu-outline' },
      { id: 'type:select', labelKey: 'censo.types.select', icon: 'radio-button-on-outline' },
      { id: 'type:multiselect', labelKey: 'censo.types.multiselect', icon: 'checkbox-outline' },
      { id: 'type:number', labelKey: 'censo.types.number', icon: 'calculator-outline' },
      { id: 'type:boolean', labelKey: 'censo.types.boolean', icon: 'toggle-outline' },
      { id: 'type:date', labelKey: 'censo.types.date', icon: 'calendar-outline' },
    ],
  },
  {
    headingKey: 'censo.builder.elementsHeading',
    rows: [
      { id: 'entity:barrios', labelKey: 'censo.builder.sourceBarrios', icon: 'map-outline' },
      { id: 'entity:places', labelKey: 'censo.builder.sourcePlaces', icon: 'location-outline' },
      { id: 'entity:organizations', labelKey: 'censo.builder.sourceOrganizations', icon: 'people-outline' },
      { id: 'entity:events', labelKey: 'censo.builder.sourceEvents', icon: 'calendar-outline' },
      { id: 'entity:festivalPosters', labelKey: 'censo.builder.sourceFestivalPosters', icon: 'image-outline' },
      { id: 'entity:news', labelKey: 'censo.builder.sourceNews', icon: 'newspaper-outline' },
    ],
  },
];

export function QuestionTypeSheet({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current?: SheetPick;
  onSelect: (pick: SheetPick) => void;
  onClose: () => void;
}) {
  return (
    <TypeSheet
      visible={visible}
      titleKey="questions.typeSheetTitle"
      sections={SECTIONS}
      currentId={current ? rowId(current) : undefined}
      onSelect={(id) => onSelect(parseRowId(id))}
      onClose={onClose}
    />
  );
}
