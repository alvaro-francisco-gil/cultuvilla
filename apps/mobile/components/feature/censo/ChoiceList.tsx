import { View } from 'react-native';
import { Pressable, Text, HStack } from '../../primitives';

export interface ChoiceOption {
  value: string;
  label: string;
  imageUri?: string | null;
  disabled?: boolean;
}

export interface ChoiceListProps {
  options: ChoiceOption[];
  mode: 'single' | 'multi';
  value: string | string[] | undefined;
  onChange: (next: string | string[]) => void;
}

export function ChoiceList({ options, mode, value, onChange }: ChoiceListProps) {
  const selected = new Set(
    Array.isArray(value) ? value : value !== undefined ? [value] : [],
  );

  function toggle(v: string) {
    if (mode === 'single') {
      onChange(v);
      return;
    }
    const next = new Set(selected);
    if (next.has(v)) {
      next.delete(v);
    } else {
      next.add(v);
    }
    onChange([...next]);
  }

  return (
    <HStack gap={2} className="flex-wrap">
      {options.map((o) => {
        const on = selected.has(o.value);
        return (
          <Pressable
            key={o.value}
            disabled={o.disabled}
            onPress={() => toggle(o.value)}
          >
            <View
              className={[
                'px-3 py-2 rounded-full border',
                on ? 'bg-accent border-accent' : 'border-subtle bg-surface',
                o.disabled ? 'opacity-50' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Text className={on ? 'text-on-accent' : 'text-primary'}>{o.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </HStack>
  );
}
