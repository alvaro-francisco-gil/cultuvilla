/**
 * Icon size scale (in px). Use these with `lucide-react` (web) or
 * `lucide-react-native` (mobile): `<Calendar size={iconSizes.md} />`.
 * Three sizes keep visual rhythm tight; if a screen really needs a 32px
 * icon it's probably actually an illustration — wrap it in <Image>.
 */
export const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

export type IconSize = keyof typeof iconSizes;
