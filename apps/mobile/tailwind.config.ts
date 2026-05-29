import type { Config } from 'tailwindcss';
// Relative path to the TS source so jiti can resolve at tailwind-config load
// time. The package subpath `@cultuvilla/shared/design-system` does not work
// here: jiti uses node CJS resolution which would need an `exports` map on
// `packages/shared/package.json`. The TS source resolves directly.
import {
  colors as semanticColors,
  elevation,
  radii,
  spacing as semanticSpacing,
  typography,
  zIndex,
} from '../../packages/shared/src/design-system';

// Helper: convert numeric-valued record to px-string record
function pxRecord<T extends Record<string | number, number>>(rec: T): Record<keyof T, string> {
  const out = {} as Record<keyof T, string>;
  for (const k of Object.keys(rec) as Array<keyof T>) {
    out[k] = `${rec[k]}px`;
  }
  return out;
}

// Helper: convert numeric-valued record to string record (for zIndex)
function stringRecord<T extends Record<string, number>>(rec: T): Record<keyof T, string> {
  const out = {} as Record<keyof T, string>;
  for (const k of Object.keys(rec) as Array<keyof T>) {
    out[k] = String(rec[k]);
  }
  return out;
}

// Build fontSize map matching web convention: variant → [size, { lineHeight, fontWeight }]
const fontSize: Record<string, [string, { lineHeight: string; fontWeight: string }]> = {};
for (const [variant, t] of Object.entries(typography)) {
  fontSize[variant] = [
    `${t.fontSize}px`,
    { lineHeight: `${t.lineHeight}px`, fontWeight: t.fontWeight },
  ];
}

const config: Config = {
  content: [
    './App.tsx',
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  // NativeWind 4 + RN-Web crashes on boot with "Cannot manually set color
  // scheme, as dark mode is type 'media'". The repo doesn't ship a dark
  // theme yet (see colors.ts), so we set 'class' to silence the runtime
  // observer; flipping the body class is a no-op until a dark palette
  // lands.
  darkMode: 'class',
  presets: [require('nativewind/preset')],
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
  plugins: [],
};

export default config;
