import { Text } from '../primitives/Text';
import { colors } from '@cultuvilla/shared/design-system';

/** Consistent green sub-header for sections within an entity detail screen
 * (e.g. Organizadores / Descripción / Asistentes on the event screen). One
 * style so every section title matches. */
export function DetailSectionHeading({ children }: { children: string }) {
  return (
    <Text variant="h3" className="font-bold" style={{ color: colors.light.fg.secondary }}>
      {children}
    </Text>
  );
}
