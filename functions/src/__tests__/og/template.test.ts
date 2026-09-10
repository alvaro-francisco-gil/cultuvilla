import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { injectMeta, injectSeoBody } from '../../og/html';
import type { OgMeta } from '../../og/fetchers';

// ogRenderer rewrites the head of the web build's REAL document template, so
// that is what these run against — not a hand-written fixture. A fixture is how
// a regex that matched `<title>` inside the template's own HTML comment shipped:
// it deleted everything from the comment to the real </title>, taking
// <html lang="es">, <head>, charset and the viewport meta with it, and every
// share-link page rendered at desktop width on phones.
const TEMPLATE = readFileSync(
  join(__dirname, '../../../../apps/mobile/public/index.html'),
  'utf8',
);

const EVENT: OgMeta = {
  title: 'Fiestas de Santiago',
  description: 'Tres días de fiesta',
  imageUrl: 'https://cdn.example/f.jpg',
  detail: {
    kind: 'event',
    startDate: '2026-07-25T10:00:00.000Z',
    endDate: null,
    locationName: 'Plaza Mayor',
    villageName: 'Matabuena',
    municipalityId: 'm1',
    cancelled: false,
  },
};

function render(og: OgMeta | null): string {
  return injectSeoBody(injectMeta(TEMPLATE, og, 'https://cultuvilla.es/event/e1'), og);
}

describe('ogRenderer over the real web template', () => {
  for (const [label, og] of [
    ['a real doc', EVENT],
    ['no doc (default preview)', null],
  ] as const) {
    describe(label, () => {
      const html = render(og);

      it('keeps the document structure the browser needs', () => {
        expect(html).toContain('<html lang="es">');
        expect(html).toContain('<head>');
        expect(html).toContain('<meta charset="utf-8" />');
        // Without this, phones lay the page out at desktop width.
        expect(html).toMatch(/<meta name="viewport" content="width=device-width/);
        expect(html).toContain('<div id="root"></div>');
      });

      it('keeps the App Store tag and the body reset', () => {
        expect(html).toContain('<meta name="apple-itunes-app" content="app-id=');
        expect(html).toContain('<style id="expo-reset">');
      });

      it('leaves exactly one title and one description', () => {
        expect(html.match(/<title>/g)).toHaveLength(1);
        expect(html.match(/<meta name="description"/g)).toHaveLength(1);
      });

      it('leaves no unterminated comment swallowing the page', () => {
        expect((html.match(/<!--/g) ?? []).length).toBe((html.match(/-->/g) ?? []).length);
      });
    });
  }
});
