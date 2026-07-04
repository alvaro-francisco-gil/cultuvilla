function parse(v: string): [number, number, number] {
  const parts = v.split('.').map((s) => Number(s));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`Invalid semver: "${v}"`);
  }
  return [parts[0], parts[1], parts[2]];
}

/** Compare two `MAJOR.MINOR.PATCH` strings numerically. Throws on malformed input. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}
