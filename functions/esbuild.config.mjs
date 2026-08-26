import { build } from 'esbuild';
import { rmSync } from 'node:fs';

// Cloud Functions (gen2) uploads only the functions/ dir — node_modules is
// ignored (firebase.json) and firebase-tools does not pack `file:` deps — so the
// @cultuvilla/shared workspace package never reaches the container. Bundling it
// (and pure-JS deps like zod) into a single CommonJS dist/index.js makes the
// upload self-contained. firebase-admin and firebase-functions stay external:
// they're declared in package.json dependencies and installed in the runtime,
// and the functions framework must load the runtime's own firebase-functions
// instance to discover triggers.
//
// `sharp` is external for a different reason: it is a NATIVE module. Bundling
// it produces a `createRequire(import.meta.url)` call in CJS output where
// `import.meta` does not exist, so the bundle throws ERR_INVALID_ARG_VALUE at
// load and the functions emulator reports only "codebase could not be analyzed
// successfully". Like firebase-admin it is a declared dependency, so the
// runtime installs it (with its prebuilt linux-x64 binary) itself.
rmSync(new URL('./dist', import.meta.url), { recursive: true, force: true });

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: [
    'firebase-admin',
    'firebase-admin/*',
    'firebase-functions',
    'firebase-functions/*',
    'sharp',
  ],
});
