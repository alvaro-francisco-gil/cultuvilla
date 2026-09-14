import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_STORE_ID } from '../appStores';

// With web.output 'single', Expo builds the web document from public/index.html
// and ignores app/+html.tsx — which is how a lang fix and the iOS App Store tag
// once sat dead in production. These pin the template itself; the deploy's
// check-web-export gate pins the built output.
const template = readFileSync(join(__dirname, '../../public/index.html'), 'utf8');

describe('public/index.html', () => {
  it('declares the page Spanish, so Chrome does not offer to translate it', () => {
    expect(template).toMatch(/<html lang="es">/);
  });

  // SmartAppBanner stands down on iOS Safari because Safari draws its own bar
  // from this tag. A stale id would offer a different app — or none.
  it('points Safari at the same App Store listing as the rest of the app', () => {
    expect(template).toContain(`<meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}" />`);
  });

  // Expo fills the title placeholder with String.replace, which swaps only the
  // FIRST occurrence. A mention anywhere above <title> — even in a comment —
  // leaves the literal placeholder as the page title.
  it('carries the title placeholder exactly once, inside <title>', () => {
    const placeholder = '%WEB_' + 'TITLE%';
    expect(template.split(placeholder)).toHaveLength(2);
    expect(template).toContain(`<title>${placeholder}</title>`);
  });

  it('keeps the #root element the SPA mounts into', () => {
    expect(template).toContain('<div id="root"></div>');
  });
});
