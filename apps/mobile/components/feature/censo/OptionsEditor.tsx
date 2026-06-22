import { Input, Button, Pressable, Text, VStack, HStack } from '../../primitives';
import { useT } from '../../../lib/i18n';

export function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useT();
  return (
    <VStack gap={2}>
      {options.map((opt, i) => (
        <HStack key={i} gap={2} align="center">
          <Input
            value={opt}
            onChangeText={(v) => onChange(options.map((o, j) => (j === i ? v : o)))}
            placeholder={t('censo.builder.optionPlaceholder')}
          />
          <Pressable onPress={() => onChange(options.filter((_, j) => j !== i))}>
            <Text className="text-red-600">{t('common.delete')}</Text>
          </Pressable>
        </HStack>
      ))}
      <Button variant="ghost" onPress={() => onChange([...options, ''])}>
        {t('censo.builder.addOption')}
      </Button>
    </VStack>
  );
}
