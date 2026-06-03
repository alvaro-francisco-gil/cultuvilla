import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

// Regression guard for the Android / React-Native bundling failure:
//
//   villageMemberService -> villageMemberConverter -> sdkAdapters.admin
//     -> firebase-admin/firestore -> @google-cloud/firestore -> node:stream  ✗
//
// Metro performs NO cross-module dead-code elimination: importing a module
// pulls in every one of its top-level imports, even ones that are never used.
// A converter file that exported BOTH the client and admin converters therefore
// dragged firebase-admin into every client consumer, and the RN runtime has no
// Node stdlib ("stream"), so the bundle blew up.
//
// This test walks the static import graph from the client entry points
// (refs/client + every service — services are the only client Firebase ingress)
// and fails if any reachable module imports firebase-admin at runtime.

const SRC = resolve(__dirname, '../../src');

function clientEntryFiles(): string[] {
  const servicesDir = resolve(SRC, 'services');
  const services = readdirSync(servicesDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(servicesDir, f));
  // The full client surface: the package's public entry (`@cultuvilla/shared`
  // → src/index.ts), the client refs subpath export, and every service (the
  // only client Firebase ingress).
  return [
    resolve(SRC, 'index.ts'),
    resolve(SRC, 'firebase/refs/client.ts'),
    ...services,
  ];
}

function resolveRelativeImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null; // bare module — outside our source graph
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

// Matches `import … from '…'` / `export … from '…'`. Group 1 is set when the
// statement is a type-only import/export (`import type …`), which TypeScript
// erases and so never reaches the bundle — those are safe to ignore.
const FROM_RE = /\b(?:import|export)\b(\s+type\b)?[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g;
// Side-effect imports: `import '…'`.
const BARE_RE = /\bimport\s*['"]([^'"]+)['"]/g;

interface Ref {
  spec: string;
  typeOnly: boolean;
}

function importRefs(source: string): Ref[] {
  const refs: Ref[] = [];
  let m: RegExpExecArray | null;
  FROM_RE.lastIndex = 0;
  while ((m = FROM_RE.exec(source)) !== null) {
    refs.push({ spec: m[2], typeOnly: Boolean(m[1]) });
  }
  BARE_RE.lastIndex = 0;
  while ((m = BARE_RE.exec(source)) !== null) {
    refs.push({ spec: m[1], typeOnly: false });
  }
  return refs;
}

function isFirebaseAdmin(spec: string): boolean {
  return spec === 'firebase-admin' || spec.startsWith('firebase-admin/');
}

describe('client bundle does not import firebase-admin', () => {
  it('no module reachable from the client entry points imports firebase-admin', () => {
    const queue = clientEntryFiles();
    const visited = new Set<string>(queue);
    const parent = new Map<string, string>();
    const violations: string[] = [];

    while (queue.length) {
      const file = queue.shift();
      if (file === undefined) break;
      let source: string;
      try {
        source = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      for (const { spec, typeOnly } of importRefs(source)) {
        if (isFirebaseAdmin(spec)) {
          if (typeOnly) continue; // erased at compile time, never bundled
          const chain: string[] = [file];
          let p = parent.get(file);
          while (p) {
            chain.unshift(p);
            p = parent.get(p);
          }
          violations.push(
            `${spec}\n    via ${chain.map((c) => c.replace(SRC, 'src')).join('\n      -> ')}`,
          );
          continue;
        }
        const resolved = resolveRelativeImport(file, spec);
        if (resolved && !visited.has(resolved)) {
          visited.add(resolved);
          parent.set(resolved, file);
          queue.push(resolved);
        }
      }
    }

    expect(
      violations,
      `client bundle leaks firebase-admin (Metro has no tree-shaking):\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
