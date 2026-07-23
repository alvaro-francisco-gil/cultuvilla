import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import ts from 'typescript';

/**
 * Real-Chromium regression for the desktop card-row arrows.
 *
 * The bug: the arrow handler paged the row via `animateScrollLeft`, handing it a
 * scheduler whose `requestFrame`/`cancelFrame` were the *bare* global
 * `requestAnimationFrame`/`cancelAnimationFrame`. Calling those as methods of a
 * plain object makes the browser invoke a WebIDL method with `this` ≠ `window`,
 * which throws `TypeError: Illegal invocation` — so the first arrow click blew
 * up and nothing scrolled. jsdom does not enforce that receiver check, so only a
 * real browser can catch this; hence Playwright rather than a jest unit test.
 *
 * We load the REAL `lib/horizontalScroll.ts` (transpiled on the fly — it is
 * dependency-free) into the page, then drive a real overflowing scroller two
 * ways:
 *   - the fixed wiring (the module's default, window-bound scheduler) → scrolls,
 *   - the old buggy wiring (unbound globals) → throws "Illegal invocation",
 * so the test proves both that the fix works and that it would have caught the
 * regression.
 */

const MODULE_SRC = readFileSync(
  path.join(__dirname, '..', '..', 'lib', 'horizontalScroll.ts'),
  'utf8',
);

// Transpile the TS module to CommonJS text we can execute inside the page and
// expose on `window.HSCROLL` — this runs the shipped source, not a copy.
const MODULE_JS = ts.transpileModule(MODULE_SRC, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText;

const PAGE = `<!doctype html><html><body>
  <div id="a" style="width:200px;overflow-x:auto;white-space:nowrap;display:flex">
    <div style="flex:0 0 900px;height:40px"></div>
  </div>
  <div id="b" style="width:200px;overflow-x:auto;white-space:nowrap;display:flex">
    <div style="flex:0 0 900px;height:40px"></div>
  </div>
</body></html>`;

test.describe('desktop scroll-arrow paging (real browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(PAGE);
    await page.evaluate((code) => {
      const exports: Record<string, unknown> = {};
      // eslint-disable-next-line no-new-func
      new Function('exports', code)(exports);
      (window as unknown as { HSCROLL: typeof exports }).HSCROLL = exports;
    }, MODULE_JS);
  });

  test('fixed wiring: a right page actually advances the row, no exception', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    const before = await page.evaluate(() => {
      const hs = (window as any).HSCROLL;
      const node = document.getElementById('a')!;
      const target = hs.pageScrollTarget(node, 'right');
      // Exactly what HorizontalScrollRow now calls: default (window-bound) scheduler.
      hs.animateScrollLeft(node, target);
      return { start: node.scrollLeft, target };
    });
    expect(before.target).toBeGreaterThan(0);

    // The animation runs across rAF frames — wait for it to land near the target.
    await page.waitForFunction(
      (t) => document.getElementById('a')!.scrollLeft >= t - 1,
      before.target,
      { timeout: 2000 },
    );

    const end = await page.evaluate(() => document.getElementById('a')!.scrollLeft);
    expect(end).toBeGreaterThan(before.start);
    expect(pageErrors, 'no Illegal invocation on the fixed path').toEqual([]);
  });

  test('old buggy wiring throws Illegal invocation (guards the regression)', async ({ page }) => {
    const outcome = await page.evaluate(() => {
      const hs = (window as any).HSCROLL;
      const node = document.getElementById('b')!;
      try {
        hs.animateScrollLeft(node, hs.pageScrollTarget(node, 'right'), {
          requestFrame: requestAnimationFrame, // unbound — the pre-fix wiring
          cancelFrame: cancelAnimationFrame,
        });
        return { threw: false, message: '' };
      } catch (e) {
        return { threw: true, message: String((e as Error).message ?? e) };
      }
    });
    expect(outcome.threw).toBe(true);
    expect(outcome.message).toMatch(/Illegal invocation/i);
  });
});
