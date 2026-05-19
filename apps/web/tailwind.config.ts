import type { Config } from 'tailwindcss';
import {
  colors as semanticColors,
  elevation,
  iconSizes,
  radii,
  spacing as semanticSpacing,
  typography,
  zIndex,
} from '@cultuvilla/shared/design-system';

// Tailwind v4 reads this file in addition to the CSS-first config in
// `app/globals.css`. We extend the theme so tokens are reachable as
// utility classes (`bg-surface`, `text-primary`, `rounded-md`,
// `shadow-sm`, `z-modal`, `text-body`). Numeric spacing keys (`p-4`)
// keep matching Tailwind's defaults because our scale uses the same
// numeric keys for the same px values.
//
// Colors are split across `backgroundColor` / `textColor` / `borderColor`
// instead of a single `colors` block, so class names stay flat:
// `bg-surface` and `text-primary` instead of `bg-surface`.

function pxRecord<T extends Record<string, number>>(rec: T): Record<keyof T, string> {
  const out = {} as Record<keyof T, string>;
  for (const k of Object.keys(rec) as Array<keyof T>) {
    out[k] = `${rec[k]}px`;
  }
  return out;
}

function stringRecord<T extends Record<string, number>>(rec: T): Record<keyof T, string> {
  const out = {} as Record<keyof T, string>;
  for (const k of Object.keys(rec) as Array<keyof T>) {
    out[k] = String(rec[k]);
  }
  return out;
}

const fontSize: Record<string, [string, { lineHeight: string; fontWeight: string }]> = {};
for (const [variant, t] of Object.entries(typography)) {
  fontSize[variant] = [
    `${t.fontSize}px`,
    { lineHeight: `${t.lineHeight}px`, fontWeight: t.fontWeight },
  ];
}

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      spacing: pxRecord(semanticSpacing),
      borderRadius: pxRecord(radii),
      fontSize,
      backgroundColor: semanticColors.light.bg,
      textColor: semanticColors.light.fg,
      borderColor: semanticColors.light.border,
      boxShadow: {
        none: elevation.none.web,
        sm: elevation.sm.web,
        md: elevation.md.web,
      },
      zIndex: stringRecord(zIndex),
    },
  },
};

// Re-export iconSizes for ergonomic consumers (some folks like to import
// from the Tailwind config; the canonical export is still the shared module).
export { iconSizes };
export default config;
