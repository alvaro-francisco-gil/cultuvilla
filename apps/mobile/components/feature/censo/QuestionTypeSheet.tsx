import { Dimensions, Modal, Pressable as RNPressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, HStack } from '../../primitives';
import { useT } from '../../../lib/i18n';
import { ACCENT } from '../VillageSections';
import type { FieldType, OptionsSource } from '@cultuvilla/shared/models/municipality/CensoTypes';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = Math.round(SCREEN_HEIGHT * 0.9);

/**
 * A pick from the type sheet: either a generic question type, or a village
 * element (an entity-backed choice on a specific source).
 */
export type SheetPick =
  | { kind: 'type'; type: FieldType }
  | { kind: 'entity'; source: OptionsSource };

interface Row {
  pick: SheetPick;
  /** Full i18n key for the label. */
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TYPE_ROWS: Row[] = [
  { pick: { kind: 'type', type: 'text' }, labelKey: 'censo.types.text', icon: 'text-outline' },
  { pick: { kind: 'type', type: 'textarea' }, labelKey: 'censo.types.textarea', icon: 'menu-outline' },
  { pick: { kind: 'type', type: 'select' }, labelKey: 'censo.types.select', icon: 'radio-button-on-outline' },
  { pick: { kind: 'type', type: 'multiselect' }, labelKey: 'censo.types.multiselect', icon: 'checkbox-outline' },
  { pick: { kind: 'type', type: 'number' }, labelKey: 'censo.types.number', icon: 'calculator-outline' },
  { pick: { kind: 'type', type: 'boolean' }, labelKey: 'censo.types.boolean', icon: 'toggle-outline' },
  { pick: { kind: 'type', type: 'date' }, labelKey: 'censo.types.date', icon: 'calendar-outline' },
];

const ENTITY_ROWS: Row[] = [
  { pick: { kind: 'entity', source: 'barrios' }, labelKey: 'censo.builder.sourceBarrios', icon: 'map-outline' },
  { pick: { kind: 'entity', source: 'places' }, labelKey: 'censo.builder.sourcePlaces', icon: 'location-outline' },
  { pick: { kind: 'entity', source: 'organizations' }, labelKey: 'censo.builder.sourceOrganizations', icon: 'people-outline' },
  { pick: { kind: 'entity', source: 'events' }, labelKey: 'censo.builder.sourceEvents', icon: 'calendar-outline' },
  { pick: { kind: 'entity', source: 'festivalPosters' }, labelKey: 'censo.builder.sourceFestivalPosters', icon: 'image-outline' },
  { pick: { kind: 'entity', source: 'news' }, labelKey: 'censo.builder.sourceNews', icon: 'newspaper-outline' },
];

function samePick(a: SheetPick | undefined, b: SheetPick): boolean {
  if (!a) return false;
  if (a.kind === 'type' && b.kind === 'type') return a.type === b.type;
  if (a.kind === 'entity' && b.kind === 'entity') return a.source === b.source;
  return false;
}

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
  const { t } = useT();

  function renderRow(row: Row) {
    const active = samePick(current, row.pick);
    return (
      <Pressable
        key={row.labelKey}
        onPress={() => {
          onSelect(row.pick);
          onClose();
        }}
        className={`px-4 py-3 ${active ? 'bg-subtle' : ''}`}
      >
        <HStack gap={3} align="center">
          <Ionicons name={row.icon} size={22} color={ACCENT} />
          <Text className="flex-1">{t(row.labelKey)}</Text>
          {active ? <Ionicons name="checkmark" size={20} color={ACCENT} /> : null}
        </HStack>
      </Pressable>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* absoluteFill (not flex-1): RN-Web collapses a flex-1 Modal child to zero
          height, which in turn starved the sheet's max-height calculation and
          cropped the last rows with no way to scroll to them. */}
      <RNPressable
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }]}
      >
        {/* No-op onPress stops a tap on the sheet itself from bubbling to the
            backdrop and closing the sheet. */}
        <RNPressable
          onPress={() => {}}
          className="bg-surface rounded-t-2xl overflow-hidden"
          style={{ maxHeight: SHEET_MAX_HEIGHT }}
        >
          <SafeAreaView edges={['bottom']} className="shrink">
            <View className="px-4 pt-4 pb-2">
              <Text variant="h3">{t('censo.builder.typeSheetTitle')}</Text>
            </View>
            <ScrollView className="shrink">
              {TYPE_ROWS.map(renderRow)}

              <View className="px-4 pt-4 pb-1">
                <Text variant="bodySm" tone="muted">{t('censo.builder.elementsHeading')}</Text>
              </View>
              {ENTITY_ROWS.map(renderRow)}
            </ScrollView>
          </SafeAreaView>
        </RNPressable>
      </RNPressable>
    </Modal>
  );
}
