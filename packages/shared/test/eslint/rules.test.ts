import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// These tests invoke the *actual* apps/web ESLint config against inline source
// so that the service-layer-ownership rule cannot be silently weakened. They
// run the installed eslint binary from apps/web/node_modules so no extra deps
// are needed in the shared package.

const repoRoot = resolve(__dirname, '../../../..');
const webDir = resolve(repoRoot, 'apps/web');
const eslintBin = resolve(webDir, 'node_modules/.bin/eslint');

interface LintMessage {
  ruleId: string | null;
  severity: number;
  message: string;
}

interface LintResult {
  exitCode: number;
  messages: LintMessage[];
}

function runEslint(stdinFilename: string, source: string): LintResult {
  const res = spawnSync(
    eslintBin,
    [
      '--stdin',
      '--stdin-filename',
      stdinFilename,
      '--format',
      'json',
      '--no-color',
    ],
    {
      input: source,
      cwd: webDir,
      encoding: 'utf-8',
    },
  );
  // ESLint exits 0 (no issues) or 1 (issues) on success; 2 indicates the
  // tool itself errored. The latter should never happen in tests and we
  // want a loud failure.
  if (res.status === 2 || res.error) {
    throw new Error(
      `eslint failed to run: status=${res.status} err=${res.error?.message} stderr=${res.stderr}`,
    );
  }
  const parsed = JSON.parse(res.stdout) as Array<{ messages: LintMessage[] }>;
  const messages = parsed.flatMap((r) => r.messages);
  return { exitCode: res.status ?? 0, messages };
}

const eslintInstalled = existsSync(eslintBin);

describe.skipIf(!eslintInstalled)(
  'apps/web ESLint rules (service-layer ownership + no-explicit-any)',
  () => {
    it('flags direct `firebase/firestore` imports outside the auth boundary', () => {
      const { exitCode, messages } = runEslint(
        'components/feed/Bad.tsx',
        "import { collection } from 'firebase/firestore';\nvoid collection;\n",
      );
      expect(exitCode).toBe(1);
      expect(messages.map((m) => m.ruleId)).toContain('no-restricted-imports');
    });

    it('flags direct `firebase/auth` imports outside the auth boundary', () => {
      const { exitCode, messages } = runEslint(
        'components/event/Bad.tsx',
        "import { signInWithPopup } from 'firebase/auth';\nvoid signInWithPopup;\n",
      );
      expect(exitCode).toBe(1);
      expect(messages.map((m) => m.ruleId)).toContain('no-restricted-imports');
    });

    it('flags direct `firebase/storage` imports', () => {
      const { exitCode, messages } = runEslint(
        'lib/storage.ts',
        "import { ref } from 'firebase/storage';\nvoid ref;\n",
      );
      expect(exitCode).toBe(1);
      expect(messages.map((m) => m.ruleId)).toContain('no-restricted-imports');
    });

    it('allows `firebase/auth` inside contexts/AuthContext.tsx', () => {
      const { messages } = runEslint(
        'contexts/AuthContext.tsx',
        "import { onAuthStateChanged } from 'firebase/auth';\nvoid onAuthStateChanged;\n",
      );
      expect(messages.map((m) => m.ruleId)).not.toContain(
        'no-restricted-imports',
      );
    });

    it('flags explicit `any` annotations', () => {
      const { exitCode, messages } = runEslint(
        'components/Bad.tsx',
        'const x: any = 1;\nvoid x;\n',
      );
      expect(exitCode).toBe(1);
      expect(messages.map((m) => m.ruleId)).toContain(
        '@typescript-eslint/no-explicit-any',
      );
    });

    it('allows imports from `@cultuvilla/shared/firebase`', () => {
      const { messages } = runEslint(
        'components/Ok.tsx',
        "import { GeoPoint } from '@cultuvilla/shared/firebase';\nvoid GeoPoint;\n",
      );
      expect(messages.map((m) => m.ruleId)).not.toContain(
        'no-restricted-imports',
      );
    });
  },
);
