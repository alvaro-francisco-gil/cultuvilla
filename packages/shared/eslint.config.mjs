// packages/shared/eslint.config.mjs
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: [
      'src/firebase/**/*.ts',
      'src/models/**/*.ts',
      'src/services/eventService.ts',
      'test/firebase/**/*.ts',
    ],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strictTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
);
