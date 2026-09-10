/**
 * Build options shared by the deploy bundle and the local Wrapped preview, so a
 * preview that renders is proof the deploy bundle renders too.
 */
export const sharedBuildOptions = {
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
  // Fonts are inlined into the bundle. Only `functions/` is uploaded and nothing
  // copies loose assets into dist/, so reading a .ttf from disk at runtime would
  // work in the emulator and throw ENOENT in the deployed container.
  loader: { '.ttf': 'binary' },
};
