import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, TextInput, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getMunicipalities } from '@cultuvilla/shared/services/municipalityService';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { Button } from './Button';

interface Option {
  id: string;
  displayName: string;
}

export interface VillagePickerProps {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}

export function VillagePicker({ label, value, onChange, placeholder = 'Sin pueblo' }: VillagePickerProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!open || options.length > 0) return;
    let cancelled = false;
    getMunicipalities().then((list) => {
      if (cancelled) return;
      setOptions(
        list.map((m) => ({
          id: m.id,
          displayName: m.name,
        })),
      );
    });
    return () => { cancelled = true; };
  }, [open, options.length]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.displayName.toLowerCase().includes(q));
  }, [options, filter]);

  const selected = options.find((o) => o.id === value);

  return (
    <View>
      <Text tone="muted">{label}</Text>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={styles.trigger}>
        <Text>{selected ? selected.displayName : placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color="#64748b" />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <TextInput
            placeholder="Buscar pueblo"
            value={filter}
            onChangeText={setFilter}
            style={styles.search}
            autoCapitalize="none"
          />
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.id);
                  setOpen(false);
                  setFilter('');
                }}
                style={styles.row}
              >
                <Text>{item.displayName}</Text>
              </Pressable>
            )}
          />
          <View style={styles.actions}>
            {value && (
              <Button variant="secondary" onPress={() => { onChange(null); setOpen(false); }}>
                Quitar
              </Button>
            )}
            <Button variant="secondary" onPress={() => setOpen(false)}>
              Cancelar
            </Button>
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
  modal: { flex: 1, padding: 16, gap: 12 },
  search: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12 },
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
});
