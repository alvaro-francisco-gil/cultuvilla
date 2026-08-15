import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '../primitives/Text';
import { colors } from '@cultuvilla/shared/design-system';

/** Consistent green sub-header for sections within an entity detail screen
 * (e.g. Organizadores / Descripción / Asistentes on the event screen). One
 * style so every section title matches. `action` puts a control (e.g. the
 * roster "Editar" toggle) on the trailing edge of the same row. */
export function DetailSectionHeading({
  children,
  action,
}: {
  children: string;
  action?: ReactNode;
}) {
  // h3 is 20px; +2px per design request.
  const heading = (
    <Text
      variant="h3"
      className={action ? 'font-bold' : 'mt-4 font-bold'}
      style={{ color: colors.light.fg.secondary, fontSize: 22, lineHeight: 28 }}
    >
      {children}
    </Text>
  );

  if (!action) return heading;

  return (
    <View className="mt-4 flex-row items-center justify-between">
      {heading}
      {action}
    </View>
  );
}
