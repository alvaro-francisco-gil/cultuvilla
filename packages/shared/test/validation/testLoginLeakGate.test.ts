import { describe, it, expect } from 'vitest';
// The gate lives in repo-root scripts/; it's a pnpm-workspace-relative import.
// Importing it does not run the CLI (main() is guarded on direct invocation).
import * as leakGate from '../../../../scripts/check-no-test-login-leak.mjs';

// The gate is an untyped .mjs; describe its exported surface at the boundary
// (AGENTS.md: type unknown boundaries with a precise shape, don't use `any`).
interface LeakRule {
  rule: string;
  re: RegExp;
}
interface LeakViolation {
  path: string;
  line: number;
  rule: string;
  excerpt: string;
}
const { LEAK_RULES, ALLOWED_PATHS, scanForLeaks } = leakGate as unknown as {
  LEAK_RULES: LeakRule[];
  ALLOWED_PATHS: Set<string>;
  scanForLeaks: (files: { path: string; content: string }[]) => LeakViolation[];
};

// If this test breaks after a regex tweak, the bypass-leak gate is weakened —
// fix the gate, not the test. The gate is the third defence layer for the E2E
// auth bypass (see scripts/check-no-test-login-leak.mjs).
describe('check-no-test-login-leak gate', () => {
  it('confines the seam to the three allowlisted files', () => {
    expect(ALLOWED_PATHS.has('apps/mobile/app.config.ts')).toBe(true);
    expect(ALLOWED_PATHS.has('apps/mobile/lib/firebaseInit.ts')).toBe(true);
    expect(ALLOWED_PATHS.has('apps/mobile/lib/auth/AuthContext.tsx')).toBe(true);
    expect(ALLOWED_PATHS.size).toBe(3);
  });

  it.each([
    ["const on = process.env.USE_FIREBASE_EMULATOR === '1';", 'USE_FIREBASE_EMULATOR flag'],
    ['if (Constants.expoConfig?.extra?.useEmulator) doThing();', 'useEmulator flag'],
    ["connectAuthEmulator(getAuth(), 'http://127.0.0.1:9099');", 'connectAuthEmulator'],
    ["connectFirestoreEmulator(getDb(), '127.0.0.1', 8080);", 'connectFirestoreEmulator'],
    ['connectFunctionsEmulator(fns, host, 5001);', 'connectFunctionsEmulator'],
    ['connectStorageEmulator(store, host, 9199);', 'connectStorageEmulator'],
    ['window.__cultuvillaE2E?.login(email, password);', '__cultuvillaE2E helper'],
  ])('flags a leak: %s', (line) => {
    const violations = scanForLeaks([{ path: 'apps/mobile/screens/Leak.tsx', content: line }]);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('ignores benign lines that merely resemble the tokens', () => {
    const benign = [
      'const useModal = true;',
      'function connectToServer() {}',
      'const emulatorDocsUrl = "https://firebase.google.com";',
      '// plain comment about the emulator',
    ].join('\n');
    expect(scanForLeaks([{ path: 'apps/mobile/screens/Ok.tsx', content: benign }])).toHaveLength(0);
  });

  it('honours the `// test-login: allowed` escape hatch on the line above', () => {
    const content = [
      '// test-login: allowed',
      'const on = process.env.USE_FIREBASE_EMULATOR;',
    ].join('\n');
    expect(scanForLeaks([{ path: 'apps/mobile/lib/special.ts', content }])).toHaveLength(0);
  });

  it('exposes one rule per guarded symbol group', () => {
    // Four symbol families: the flag env var, its surfaced form, the connect*
    // calls, and the window helper. Keeps the gate's surface auditable.
    expect(LEAK_RULES).toHaveLength(4);
    for (const { re } of LEAK_RULES) expect(re).toBeInstanceOf(RegExp);
  });
});
