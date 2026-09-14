import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buildFiestaBlock, fiestaBlockId, type FiestaBlock } from '@cultuvilla/shared/models';
import { iconSizes } from '@cultuvilla/shared/design-system';
import { HStack, Input, Pressable, Text, VStack, Button } from '../primitives';
import { useT } from '../../lib/i18n';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Most village fiestas are in summer; the admin taps the right month straight after. */
const DEFAULT_MONTH = 8;

interface Props {
  blocks: FiestaBlock[];
  onChange: (next: FiestaBlock[]) => void;
}

/**
 * Declare a village's fiestas: a name and the month they fall in, nothing more.
 * The exact days move from year to year, so they are picked when that year's
 * Wrapped is created (`/<pueblo>/resumen`), not kept up to date here.
 */
export function FiestasEditor({ blocks, onChange }: Props) {
  const { t } = useT();
  const [draftName, setDraftName] = useState('');
  // Names are edited locally and committed on blur. Persisting every keystroke
  // would write `name: ''` the moment the field is cleared, and a municipality
  // is read through a strict converter — one empty name makes the village
  // document unreadable for everyone. An empty name on blur reverts.
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  const ids = useMemo(() => blocks.map((b) => b.id), [blocks]);

  const replace = useCallback(
    (id: string, next: FiestaBlock) => onChange(blocks.map((b) => (b.id === id ? next : b))),
    [blocks, onChange],
  );

  function add() {
    const name = draftName.trim();
    if (name === '') return;
    onChange([...blocks, buildFiestaBlock({ id: fiestaBlockId(name, ids), name, month: DEFAULT_MONTH })]);
    setDraftName('');
  }

  function remove(id: string) {
    setNameDrafts((d) => {
      const { [id]: _dropped, ...rest } = d;
      return rest;
    });
    onChange(blocks.filter((b) => b.id !== id));
  }

  function commitName(block: FiestaBlock) {
    const draft = (nameDrafts[block.id] ?? block.name).trim();
    setNameDrafts((d) => {
      const { [block.id]: _dropped, ...rest } = d;
      return rest;
    });
    if (draft !== '' && draft !== block.name) replace(block.id, { ...block, name: draft });
  }

  return (
    <VStack gap={3}>
      <Text variant="h3" className="mt-2">
        {t('village.fiestas.title')}
      </Text>
      <Text variant="caption" className="text-secondary">
        {t('village.fiestas.help')}
      </Text>

      {blocks.map((block) => (
        <View key={block.id} className="rounded-md border border-subtle p-3">
          <VStack gap={2}>
            <HStack className="items-center justify-between">
              <Input
                value={nameDrafts[block.id] ?? block.name}
                onChangeText={(name) => setNameDrafts((d) => ({ ...d, [block.id]: name }))}
                onBlur={() => commitName(block)}
                placeholder={t('village.fiestas.namePlaceholder')}
                className="flex-1"
                testID={`fiesta-${block.id}-name`}
              />
              <Pressable
                onPress={() => remove(block.id)}
                accessibilityLabel={t('village.fiestas.remove')}
                testID={`fiesta-remove-${block.id}`}
                className="ml-2"
              >
                <Ionicons name="trash-outline" size={iconSizes.md} />
              </Pressable>
            </HStack>

            <Text variant="caption" className="text-secondary">
              {t('village.fiestas.monthLabel')}
            </Text>
            <HStack gap={1} className="flex-wrap">
              {MONTHS.map((label, i) => {
                const selected = block.month === i + 1;
                return (
                  <Pressable
                    key={label}
                    onPress={() => replace(block.id, { ...block, month: i + 1 })}
                    accessibilityState={{ selected }}
                    testID={`fiesta-${block.id}-month-${String(i + 1)}`}
                    className={`rounded-sm px-2 py-1 ${selected ? 'bg-primary' : 'bg-surface-elevated'}`}
                  >
                    <Text variant="caption" className={selected ? 'text-on-primary' : ''}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </VStack>
        </View>
      ))}

      <HStack gap={2} className="items-center">
        <Input
          value={draftName}
          onChangeText={setDraftName}
          placeholder={t('village.fiestas.namePlaceholder')}
          className="flex-1"
          testID="fiesta-new-name"
        />
        <Button onPress={add} disabled={draftName.trim() === ''} testID="fiesta-add">
          {t('village.fiestas.add')}
        </Button>
      </HStack>
    </VStack>
  );
}
