/**
 * Accessibility constants used by interactive primitives.
 *
 * `minTouchTarget` is 44 (Apple HIG, WCAG 2.5.5). The `<Pressable>`
 * primitive enforces this by guaranteeing 44 of padded hit area even
 * when the visible target is smaller (e.g. a 24px icon button).
 *
 * `defaultHitSlop` is an RN-shaped value (top/bottom/left/right) used
 * by RN's <Pressable>. On web it's translated to padding by the
 * `<Pressable>` wrapper.
 */
export const a11y = {
  minTouchTarget: 44,
  defaultHitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
} as const;
