import { describe, it, expect, expectTypeOf } from 'vitest';
import { GeoPoint, Timestamp, type User } from '../../src/firebase';

describe('@cultuvilla/shared/firebase re-exports', () => {
  // These re-exports back the service-layer ownership rule: apps must not
  // import directly from `firebase/firestore` / `firebase/auth` for these
  // symbols. If a re-export disappears, every consumer breaks at build time
  // and the no-restricted-imports rule loses its escape hatch.

  it('exports GeoPoint as a constructable class', () => {
    const p = new GeoPoint(40.4168, -3.7038);
    expect(p.latitude).toBe(40.4168);
    expect(p.longitude).toBe(-3.7038);
  });

  it('exports Timestamp with the standard static constructors', () => {
    const d = new Date('2026-01-01T00:00:00.000Z');
    const ts = Timestamp.fromDate(d);
    expect(ts.toDate().getTime()).toBe(d.getTime());
  });

  it('exports the User type', () => {
    // Type-only assertion: vitest compiles this file, and `pnpm
    // shared:typecheck` (run from CI via `pnpm check`) re-checks it. If the
    // `User` re-export is removed, this fails to compile.
    expectTypeOf<User | null>().toEqualTypeOf<User | null>();
  });
});
