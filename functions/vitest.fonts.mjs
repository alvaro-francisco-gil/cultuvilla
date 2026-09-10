import { readFileSync } from 'node:fs';

/**
 * Load `.ttf` imports as a `Uint8Array`, mirroring esbuild's `binary` loader in
 * esbuild.shared.mjs. Without it vitest resolves a font import to `undefined`,
 * so nothing that renders a Wrapped card could be tested at all.
 */
export const binaryFonts = {
  name: 'cultuvilla-binary-fonts',
  // Vite's built-in asset plugin also claims `.ttf` and returns a URL string;
  // running first is what makes the import a buffer instead.
  enforce: 'pre',
  load(id) {
    if (!id.endsWith('.ttf')) return null;
    const base64 = readFileSync(id).toString('base64');
    return `export default Uint8Array.from(Buffer.from(${JSON.stringify(base64)}, 'base64'));`;
  },
};
