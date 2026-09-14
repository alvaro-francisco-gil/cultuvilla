import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIRROR_PLAN,
  anonymizeDoc,
  assertEmulatorTarget,
  parseMirrorArgs,
  pseudonym,
} from '../lib/mirror-village.mjs';

const REAL = ['villa-events', 'cultuvilla-beta', 'cultuvilla-prod'];

describe('assertEmulatorTarget', () => {
  it('accepts a throwaway project id with the emulator running', () => {
    assert.equal(
      assertEmulatorTarget({
        emulatorHost: '127.0.0.1:8080',
        targetProjectId: 'cultuvilla-test',
        realProjectIds: REAL,
      }),
      true,
    );
  });

  it('refuses to run when no emulator is configured', () => {
    assert.throws(
      () => assertEmulatorTarget({ emulatorHost: '', targetProjectId: 'cultuvilla-test', realProjectIds: REAL }),
      /FIRESTORE_EMULATOR_HOST is not set/,
    );
  });

  // The whole point of the script is that it reads prod. If the target guard
  // ever weakens, it stops being a mirror and becomes a cross-env overwrite.
  for (const project of REAL) {
    it(`refuses to write into the real project ${project}`, () => {
      assert.throws(
        () => assertEmulatorTarget({ emulatorHost: '127.0.0.1:8080', targetProjectId: project, realProjectIds: REAL }),
        /that is a real Firebase project/,
      );
    });
  }
});

describe('MIRROR_PLAN', () => {
  it('copies parents before children', () => {
    const order = MIRROR_PLAN.map((s) => s.collection);
    assert.ok(order.indexOf('municipalities') === 0);
    assert.ok(order.indexOf('events') < order.indexOf('registrations'));
    assert.ok(order.indexOf('events') < order.indexOf('registrationPrivate'));
  });

  it('reaches registrations per-event, since they carry no municipalityId', () => {
    const regs = MIRROR_PLAN.find((s) => s.collection === 'registrations');
    assert.equal(regs.scope, 'perEvent');
  });

  // persons carry `municipalityLinks: [{municipalityId, barrioId}]` — an array of
  // OBJECTS, which Firestore can only match whole. A `municipalityId` filter
  // silently returns zero rows rather than failing, so this is pinned.
  it('reaches persons through the municipalityPeople projection, not a field filter', () => {
    const persons = MIRROR_PLAN.find((s) => s.collection === 'persons');
    assert.equal(persons.scope, 'viaProjection');
    assert.equal(persons.from, 'municipalityPeople');
    assert.equal(persons.idField, 'personId');
  });

  it('mirrors a projection before the collection that is derived from it', () => {
    const order = MIRROR_PLAN.map((s) => s.collection);
    for (const step of MIRROR_PLAN.filter((s) => s.scope === 'viaProjection')) {
      assert.ok(order.indexOf(step.from) < order.indexOf(step.collection), `${step.from} must precede ${step.collection}`);
    }
  });

  it('includes every collection the Wrapped aggregates over', () => {
    const names = MIRROR_PLAN.map((s) => s.collection);
    for (const needed of ['events', 'registrations', 'members', 'festivalPosters', 'comments']) {
      assert.ok(names.includes(needed), `missing ${needed}`);
    }
  });
});

describe('anonymizeDoc', () => {
  it('leaves collections with no PII untouched', () => {
    const doc = { title: 'Torneo de Mus', confirmedCount: 22 };
    assert.deepEqual(anonymizeDoc('events', 'e1', doc), doc);
  });

  it('scrubs names, photos and emails but preserves structure', () => {
    const out = anonymizeDoc('persons', 'p1', { name: 'Ana', photoURL: 'https://x/y.jpg', email: 'a@b.c', barrioId: 'b1' });
    assert.notEqual(out.name, 'Ana');
    assert.equal(out.photoURL, null);
    assert.equal(out.email, 'p1@example.invalid');
    assert.equal(out.barrioId, 'b1', 'ids must survive so joins still work');
  });

  it('is deterministic, so one person reads the same everywhere', () => {
    const a = anonymizeDoc('persons', 'p1', { name: 'Ana' });
    const b = anonymizeDoc('persons', 'p1', { name: 'Ana' });
    assert.equal(a.name, b.name);
    assert.notEqual(a.name, anonymizeDoc('persons', 'p2', { name: 'Ana' }).name);
  });

  it('does not invent values for absent fields', () => {
    const out = anonymizeDoc('persons', 'p1', { name: 'Ana' });
    assert.ok(!('email' in out));
    assert.ok(!('photoURL' in out));
  });

  it('preserves an explicit null rather than replacing it', () => {
    assert.equal(anonymizeDoc('persons', 'p1', { photoURL: null }).photoURL, null);
  });
});

describe('pseudonym', () => {
  it('is stable and differs per seed', () => {
    assert.equal(pseudonym('a'), pseudonym('a'));
    assert.notEqual(pseudonym('a'), pseudonym('b'));
  });
});

describe('parseMirrorArgs', () => {
  it('defaults to a read of prod without anonymization', () => {
    const a = parseMirrorArgs(['--municipality=Matabuena']);
    assert.deepEqual(a, { source: 'prod', anonymize: false, dryRun: false, municipality: 'Matabuena' });
  });

  it('accepts the flags', () => {
    const a = parseMirrorArgs(['--municipality=X', '--source=beta', '--anonymize', '--dry-run']);
    assert.equal(a.source, 'beta');
    assert.equal(a.anonymize, true);
    assert.equal(a.dryRun, true);
  });

  it('requires a municipality', () => {
    assert.throws(() => parseMirrorArgs([]), /Missing --municipality/);
  });

  it('rejects an unknown flag rather than silently ignoring it', () => {
    assert.throws(() => parseMirrorArgs(['--municipality=X', '--aply']), /Unknown argument/);
  });
});
