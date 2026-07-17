import { Text } from '../primitives';

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      variant="h3"
      className="font-bold"
      style={{ fontSize: 22, lineHeight: 30, marginTop: 1 }}
    >
      {children}
    </Text>
  );
}
