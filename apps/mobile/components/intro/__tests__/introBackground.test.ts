import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { colors } from '@cultuvilla/shared/design-system';

// Native splash → intro → app must be one colour, or the hand-offs flash.
// The splash is set in app.config.ts, which cannot import the design system,
// so this is what keeps the three in step.
const surface = colors.light.bg.surface.toLowerCase();

it('the intro animation is painted on the app surface', () => {
  const anim = require('../../../assets/intro/cultuvilla-intro.json') as {
    layers: { ty: number; sc?: string }[];
  };
  const solids = anim.layers.filter((l) => l.ty === 1).map((l) => l.sc?.toLowerCase());
  expect(solids).toEqual([surface]);
});

it('the native splash uses the app surface', () => {
  const config = readFileSync(join(__dirname, '../../../app.config.ts'), 'utf8');
  const splash = config.slice(config.indexOf("'expo-splash-screen'"));
  const match = splash.match(/backgroundColor:\s*'(#[0-9a-fA-F]{6})'/);
  expect(match?.[1]?.toLowerCase()).toBe(surface);
});
