import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta,
  normalizeName,
  planKindReconciliation,
  planSettlementWrites,
} from '../backfill-existing-village-settlements.mjs';

const s = (name, kind = 'pedania', isSeat = false) => ({
  name,
  kind,
  isSeat,
  lat: null,
  lng: null,
});

describe('normalizeName', () => {
  it('ignores accents, case and punctuation', () => {
    assert.equal(normalizeName('Cañicosa'), 'canicosa');
    assert.equal(normalizeName('CAÑICOSA'), 'canicosa');
    assert.equal(normalizeName('  Cañicosa '), 'canicosa');
    assert.equal(normalizeName('Villarino-de Manzanas'), 'villarino de manzanas');
  });

  it('collapses inner punctuation to a single separator', () => {
    assert.equal(normalizeName("L'Hospitalet"), 'l hospitalet');
    assert.equal(normalizeName('San  Martín   del Río'), 'san martin del rio');
  });
});

describe('planSettlementWrites', () => {
  it('writes everything into an empty village', () => {
    const { toWrite, skipped } = planSettlementWrites([s('Cañicosa'), s('Matamala')], []);
    assert.equal(toWrite.length, 2);
    assert.equal(skipped, 0);
    assert.deepEqual(
      toWrite.map((w) => w.id),
      ['osm-pedania-canicosa', 'osm-pedania-matamala'],
    );
  });

  it('never re-writes a document id it already created — a re-run is a no-op', () => {
    const settlements = [s('Cañicosa'), s('Matamala')];
    const first = planSettlementWrites(settlements, []);
    const existing = first.toWrite.map((w) => ({ id: w.id, name: w.entry.name }));

    const second = planSettlementWrites(settlements, existing);
    assert.deepEqual(second.toWrite, []);
    assert.equal(second.skipped, 2);
  });

  it('skips a settlement whose name a hand-made row already carries under another id', () => {
    // The whole point of the name check: an admin created "Cañicosa" through the
    // UI, so it has a random id. Matching on id alone would list it twice, and
    // the duplicate would be the one with no photos or residents.
    const { toWrite, skipped } = planSettlementWrites(
      [s('Cañicosa'), s('Matamala')],
      [{ id: 'aB3kZ9qTuv', name: 'Cañicosa' }],
    );
    assert.equal(skipped, 1);
    assert.deepEqual(
      toWrite.map((w) => w.entry.name),
      ['Matamala'],
    );
  });

  it('matches an existing name through accents and case', () => {
    const { toWrite } = planSettlementWrites(
      [s('Cañicosa')],
      [{ id: 'xyz', name: 'CANICOSA  ' }],
    );
    assert.deepEqual(toWrite, []);
  });

  it('keeps the first of two seed entries that normalize to the same name', () => {
    // A barrio and a pedanía can legitimately share a name. They get distinct
    // ids (kind is part of the key), so only the name check catches this — and
    // the village should not show "El Puente" twice.
    const { toWrite, skipped } = planSettlementWrites(
      [s('El Puente', 'pedania'), s('El puente', 'barrio')],
      [],
    );
    assert.equal(skipped, 1);
    assert.equal(toWrite.length, 1);
    assert.equal(toWrite[0].entry.kind, 'pedania');
  });

  it('carries kind and isSeat through untouched', () => {
    const { toWrite } = planSettlementWrites(
      [s('Ibarra', 'pedania', true), s('Untzilla', 'aldea', false)],
      [],
    );
    assert.deepEqual(
      toWrite.map((w) => [w.entry.kind, w.entry.isSeat]),
      [
        ['pedania', true],
        ['aldea', false],
      ],
    );
  });

  it('tolerates an existing row with a missing name', () => {
    const { toWrite } = planSettlementWrites([s('Cañicosa')], [{ id: 'zzz', name: undefined }]);
    assert.equal(toWrite.length, 1);
  });
});

describe('meta', () => {
  it('runs after the data it reads and the rows it sits beside', () => {
    // settlement-seeds writes the _admin documents this reads; barrio-kind gives
    // the pre-existing rows the fields the new siblings will have. Alphabetical
    // order puts `existing-village-settlements` before both, so without
    // dependsOn auto-apply would run it against missing seed data.
    assert.deepEqual(meta.dependsOn, ['settlement-seeds', 'barrio-kind']);
  });

  it('is idempotent and auto-applied everywhere', () => {
    assert.equal(meta.idempotent, true);
    assert.deepEqual(meta.autoApply, ['dev', 'beta', 'prod']);
    assert.deepEqual(meta.envs, ['dev', 'beta', 'prod']);
  });
});

describe('planKindReconciliation', () => {
  // Matabuena as it actually stands on prod: three pedanías, one of them the
  // municipal seat, all three filed as plain barrios because that is the only
  // kind firestore.rules lets a client write.
  const matabuena = [
    s('Matabuena', 'pedania', true),
    s('Cañicosa', 'pedania'),
    s('Matamala', 'pedania'),
  ];
  const asStored = (id, name) => ({ id, name, kind: 'barrio', source: 'user', isSeat: false });

  it('corrects kind and isSeat on a hand-made row OSM knows better', () => {
    const patches = planKindReconciliation(
      [asStored('iS8L', 'Cañicosa'), asStored('rDRm', 'Matabuena'), asStored('rnLx', 'Matamala')],
      matabuena,
    );
    assert.deepEqual(patches, [
      { id: 'iS8L', name: 'Cañicosa', patch: { kind: 'pedania' } },
      { id: 'rDRm', name: 'Matabuena', patch: { kind: 'pedania', isSeat: true } },
      { id: 'rnLx', name: 'Matamala', patch: { kind: 'pedania' } },
    ]);
  });

  it('never proposes a new id — the document is patched in place', () => {
    // Re-keying to `osm-pedania-*` would be a delete + create, and `barrioId` is
    // a foreign key from persons.residenceLinks and municipalityPeople. These
    // three rows carry 167 residents between them on prod.
    const patches = planKindReconciliation([asStored('rDRm', 'Matabuena')], matabuena);
    assert.equal(patches[0].id, 'rDRm');
    assert.deepEqual(Object.keys(patches[0].patch).sort(), ['isSeat', 'kind']);
  });

  it('leaves seeded rows alone', () => {
    const patches = planKindReconciliation(
      [{ id: 'osm-pedania-canicosa', name: 'Cañicosa', kind: 'pedania', source: 'osm', isSeat: false }],
      matabuena,
    );
    assert.deepEqual(patches, []);
  });

  it('leaves a hand-made row with no seed counterpart alone', () => {
    // A genuine new neighbourhood an admin added after seeding. Nothing in OSM
    // claims to know better, so nothing is touched.
    const patches = planKindReconciliation([asStored('zzz', 'El Rincón')], matabuena);
    assert.deepEqual(patches, []);
  });

  it('is a no-op once it has run', () => {
    const stored = [{ id: 'rDRm', name: 'Matabuena', kind: 'pedania', source: 'user', isSeat: true }];
    assert.deepEqual(planKindReconciliation(stored, matabuena), []);
  });

  it('patches only the field that is wrong', () => {
    const stored = [{ id: 'x', name: 'Matabuena', kind: 'pedania', source: 'user', isSeat: false }];
    assert.deepEqual(planKindReconciliation(stored, matabuena), [
      { id: 'x', name: 'Matabuena', patch: { isSeat: true } },
    ]);
  });

  it('matches through accents and case, like the write planner', () => {
    const patches = planKindReconciliation([asStored('x', 'CANICOSA')], matabuena);
    assert.deepEqual(patches, [{ id: 'x', name: 'CANICOSA', patch: { kind: 'pedania' } }]);
  });

  it('treats a missing kind/isSeat as the client default rather than crashing', () => {
    const patches = planKindReconciliation([{ id: 'x', name: 'Cañicosa', source: 'user' }], matabuena);
    assert.deepEqual(patches, [{ id: 'x', name: 'Cañicosa', patch: { kind: 'pedania' } }]);
  });
});
