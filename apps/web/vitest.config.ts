import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      '@cultuvilla/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['components/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}'],
  },
});
