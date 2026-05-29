// functions/eslint.config.mjs
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Phase 1 scope: nothing yet. Each collection-migration commit adds the
    // touched function files to this glob until Phase 4 flips it to src/**.
    files: ['src/__never__'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strictTypeChecked,
    ],
    languageOptions: {
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    ignores: ['lib/**', 'node_modules/**'],
  },
);
