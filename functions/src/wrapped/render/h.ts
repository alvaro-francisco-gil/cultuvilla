/**
 * A minimal element factory for Satori. Satori accepts React-shaped plain
 * objects, so this avoids wiring JSX into the functions build for one feature.
 */
export interface SatoriNode {
  type: string;
  props: { style?: Record<string, unknown>; children?: SatoriChild | SatoriChild[]; [key: string]: unknown };
}
export type SatoriChild = SatoriNode | string | number | null;

export function h(
  type: string,
  props: Record<string, unknown> | null,
  ...children: SatoriChild[]
): SatoriNode {
  const flat = children.filter((c) => c !== null && c !== '');
  return {
    type,
    props: { ...(props ?? {}), children: flat.length === 1 ? flat[0] : flat },
  };
}
