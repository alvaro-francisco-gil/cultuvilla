import { useState } from 'react';
import { FlatList, Modal, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { LatLng } from '@cultuvilla/shared/models/core/LocationDataModel';
import { Pressable, Text, FieldLabel, Button, Escudo } from '../primitives';
import { useT } from '../../lib/i18n';

export interface VillageOption {
  id: string;
  name: string;
  province: string;
  coordinates: LatLng | null;
  escudoThumbUrl: string | null;
}

/**
 * Village selector limited to the villages the current user has joined — the
 * event's `municipalityId` must be one the creator is a member of (enforced by
 * the Firestore create rule). Auto-selection by proximity to the picked
 * coordinates is done by the parent; this component is the manual override.
 * Rendered read-only in edit mode, since the rules forbid changing an event's
 * municipality after creation.
 */
export function MyVillagePicker({
  label,
  villages,
  value,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  villages: VillageOption[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const selected = villages.find((v) => v.id === value) ?? null;

  const trigger = (
    <View style={[styles.trigger, disabled && styles.triggerDisabled]}>
      <View style={styles.triggerInner}>
        {selected && <Escudo url={selected.escudoThumbUrl} size={28} fallbackInitial={selected.name} />}
        <Text tone={selected ? 'primary' : 'muted'}>
          {selected ? `${selected.name} (${selected.province})` : t('event.selectLocation')}
        </Text>
      </View>
      {!disabled && <Ionicons name="chevron-down" size={16} color="#64748b" />}
    </View>
  );

  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      {disabled ? (
        trigger
      ) : (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button">
          {trigger}
        </Pressable>
      )}
      {hint ? <Text variant="caption" tone="muted" style={styles.hint}>{hint}</Text> : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text variant="h3">{label}</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityLabel={t('common.close')} hitSlop={8}>
              <Ionicons name="close" size={24} color="#334155" />
            </Pressable>
          </View>
          <FlatList
            data={villages}
            keyExtractor={(v) => v.id}
            ListEmptyComponent={<Text tone="muted" style={styles.empty}>{t('event.noVillages')}</Text>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { onChange(item.id); setOpen(false); }}
                style={styles.row}
              >
                <Escudo url={item.escudoThumbUrl} size={36} fallbackInitial={item.name} />
                <View style={styles.rowText}>
                  <Text>{item.name}</Text>
                  <Text tone="muted" variant="caption">{item.province}</Text>
                </View>
                {item.id === value ? <Ionicons name="checkmark" size={20} color="#16a34a" /> : null}
              </Pressable>
            )}
          />
          <View style={styles.actions}>
            <Button variant="secondary" onPress={() => setOpen(false)}>{t('common.close')}</Button>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 4,
    backgroundColor: '#ffffff',
  },
  triggerDisabled: { backgroundColor: '#f8fafc' },
  triggerInner: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  hint: { marginTop: 4 },
  modal: { flex: 1, padding: 16, gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  empty: { textAlign: 'center', paddingVertical: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  rowText: { flex: 1 },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
});
