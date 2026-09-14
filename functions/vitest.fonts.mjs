import { readFileSync } from 'node:fs';

/**
 * Load `.ttf` and `.png` imports as a `Uint8Array`, mirroring esbuild's `binary`
 * loader in esbuild.shared.mjs. Without it vitest resolves such an import to a
 * URL or `undefined`, so nothing that renders a Wrapped card could be tested.
 */
export const binaryFonts = {
  name: 'cultuvilla-binary-fonts',
  // Vite's built-in asset plugin also claims these and returns a URL string;
  // running first is what makes the import a buffer instead.
  enforce: 'pre',
  load(id) {
    if (!id.endsWith('.ttf') && !id.endsWith('.png')) return null;
    const base64 = readFileSync(id).toString('base64');
    return `export default Uint8Array.from(Buffer.from(${JSON.stringify(base64)}, 'base64'));`;
  },
};
