import { Modal, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, HStack } from '../../primitives';
import { useT } from '../../../lib/i18n';
import { ACCENT } from '../VillageSections';
import type { FieldType } from '@cultuvilla/shared/models/municipality/CensoTypes';

/**
 * The type a builder question can take. `'entity'` is not a real FieldType —
 * it maps to a choice field backed by a village `optionsSource` (the card
 * resolves it). Everything else is a literal FieldType.
 */
export type BuilderTypeChoice = FieldType | 'entity';

interface TypeRow {
  choice: BuilderTypeChoice;
  /** i18n key under censo.types.* */
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// Order mirrors a forms builder's type menu: text first, then choice, then
// the specialized types, then our entity-backed extension last.
const ROWS: TypeRow[] = [
  { choice: 'text', labelKey: 'text', icon: 'text-outline' },
  { choice: 'textarea', labelKey: 'textarea', icon: 'menu-outline' },
  { choice: 'select', labelKey: 'select', icon: 'radio-button-on-outline' },
  { choice: 'multiselect', labelKey: 'multiselect', icon: 'checkbox-outline' },
  { choice: 'number', labelKey: 'number', icon: 'calculator-outline' },
  { choice: 'boolean', labelKey: 'boolean', icon: 'toggle-outline' },
  { choice: 'date', labelKey: 'date', icon: 'calendar-outline' },
  { choice: 'entity', labelKey: 'entity', icon: 'location-outline' },
];

export function QuestionTypeSheet({
  visible,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  current?: BuilderTypeChoice;
  onPick: (choice: BuilderTypeChoice) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Backdrop: tap to dismiss. */}
      <Pressable onPress={onClose} className="flex-1 bg-black/40 justify-end">
        {/* Stop propagation by wrapping the sheet in a non-pressable View. */}
        <View className="bg-surface rounded-t-2xl overflow-hidden">
          <SafeAreaView edges={['bottom']}>
            <View className="px-4 pt-4 pb-2">
              <Text variant="h3">{t('censo.builder.typeSheetTitle')}</Text>
            </View>
            <ScrollView className="max-h-96">
              {ROWS.map((row) => {
                const active = current === row.choice;
                return (
                  <Pressable
                    key={row.choice}
                    onPress={() => {
                      onPick(row.choice);
                      onClose();
                    }}
                    className={`px-4 py-3 ${active ? 'bg-subtle' : ''}`}
                  >
                    <HStack gap={3} align="center">
                      <Ionicons name={row.icon} size={22} color={ACCENT} />
                      <Text className="flex-1">{t(`censo.types.${row.labelKey}`)}</Text>
                      {active ? <Ionicons name="checkmark" size={20} color={ACCENT} /> : null}
                    </HStack>
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Pressable>
    </Modal>
  );
}
