import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

/**
 * NativeWind's interop collects the inline `style` prop as a *declaration* and
 * applies it with `{ ...declaration }` (react-native-css-interop
 * `applyRules`). Spreading a function yields an empty object, so on a component
 * that also carries a `className` the entire function style is silently
 * dropped — the element renders with only its Tailwind classes.
 *
 * That is how the village action pills lost their terracotta outline, padding
 * and `flex: 1` while still rendering their label. Express press/disabled
 * states with NativeWind variants (`active:opacity-70`) and keep `style` a
 * plain object.
 */
const FUNCTION_STYLE = /style=\{\(\s*[({]/;

function sourceFiles(): string[] {
  return execFileSync('git', ['ls-files', 'app', 'components', 'lib'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((f) => /\.tsx$/.test(f) && !f.includes('__tests__'));
}

describe('NativeWind inline styles', () => {
  it('never pairs a function style with a className (the style would be dropped)', () => {
    const offenders = sourceFiles().filter((file) => {
      const src = readFileSync(path.join(ROOT, file), 'utf8');
      return FUNCTION_STYLE.test(src) && /className=/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
