// Validated up-front to exactly 3 non-negative integers, so the cast below is
// sound; avoids `noUncheckedIndexedAccess` friction from indexing a bare array.
function parse(v: string): [number, number, number] {
  const parts = v.split('.').map((s) => Number(s));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`Invalid semver: "${v}"`);
  }
  return parts as [number, number, number];
}

/** Compare two `MAJOR.MINOR.PATCH` strings numerically. Throws on malformed input. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const [aMajor, aMinor, aPatch] = parse(a);
  const [bMajor, bMinor, bPatch] = parse(b);
  if (aMajor !== bMajor) return aMajor > bMajor ? 1 : -1;
  if (aMinor !== bMinor) return aMinor > bMinor ? 1 : -1;
  if (aPatch !== bPatch) return aPatch > bPatch ? 1 : -1;
  return 0;
}
