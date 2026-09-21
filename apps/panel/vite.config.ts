import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Reads the same FIREBASE_*_DEV variables the mobile build uses, from the same
  // file, so the panel adds no second set of secrets and there is no second place
  // to keep in sync. They are web API keys, public by design. Without `envDir`
  // Vite looks only in apps/panel/, finds nothing, and silently builds a bundle
  // with an empty Firebase config.
  envDir: fileURLToPath(new URL('../mobile', import.meta.url)),
  envPrefix: 'FIREBASE_',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // `@cultuvilla/shared` builds to CommonJS and is linked from the workspace
    // rather than installed, so Rollup does not pre-bundle it and cannot trace
    // named exports through its `__exportStar` barrels. Metro handles that
    // interop for the mobile app; Rollup needs to be told.
    commonjsOptions: { transformMixedEsModules: true, include: [/packages\/shared/, /node_modules/] },
  },
  optimizeDeps: { include: ['@cultuvilla/shared/models'] },
});
