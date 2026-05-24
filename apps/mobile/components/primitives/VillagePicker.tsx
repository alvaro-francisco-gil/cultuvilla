import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, TextInput, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getMunicipalities } from '@cultuvilla/shared/services/municipalityService';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { Button } from './Button';
import { Escudo } from './Escudo';

interface Option {
  id: string;
  name: string;
  province: string;
  escudoThumbUrl: string | null;
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
          name: m.name,
          province: m.province,
          escudoThumbUrl: m.escudoThumbUrl,
        })),
      );
    });
    return () => { cancelled = true; };
  }, [open, options.length]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || o.province.toLowerCase().includes(q),
    );
  }, [options, filter]);

  const selected = options.find((o) => o.id === value);

  return (
    <View>
      <Text tone="muted">{label}</Text>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={styles.trigger}>
        <View style={styles.triggerInner}>
          {selected && (
            <Escudo url={selected.escudoThumbUrl} size={28} fallbackInitial={selected.name} />
          )}
          <Text>{selected ? `${selected.name} (${selected.province})` : placeholder}</Text>
        </View>
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
            initialNumToRender={20}
            windowSize={10}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.id);
                  setOpen(false);
                  setFilter('');
                }}
                style={styles.row}
              >
                <Escudo url={item.escudoThumbUrl} size={36} fallbackInitial={item.name} />
                <View style={styles.rowText}>
                  <Text>{item.name}</Text>
                  <Text tone="muted" variant="caption">{item.province}</Text>
                </View>
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
  triggerInner: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  modal: { flex: 1, padding: 16, gap: 12 },
  search: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  rowText: { flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
});
