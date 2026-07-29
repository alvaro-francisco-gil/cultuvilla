import { colors } from '@cultuvilla/shared/design-system';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { useT } from '../../lib/i18n';

/**
 * "Editar" / "Listo" switch for a roster section heading. Destructive row
 * actions (remove, role change) stay hidden until edit mode is on, so a
 * mis-tap while reading a roster can't kick someone out of an org or an event.
 */
export function SectionEditToggle({
  editing,
  onToggle,
  testID,
}: {
  editing: boolean;
  onToggle: () => void;
  testID?: string;
}) {
  const { t } = useT();
  return (
    <Pressable
      testID={testID}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ selected: editing }}
      hitSlop={8}
    >
      <Text variant="bodySm" className="font-semibold" style={{ color: colors.light.fg.accent }}>
        {t(editing ? 'common.done' : 'common.edit')}
      </Text>
    </Pressable>
  );
}
