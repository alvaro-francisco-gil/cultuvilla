import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot } from '../lib/business-snapshot.mjs';

const TODAY = '2026-09-21';

const rec = (data, holes = 0) => ({ path: `project/x/${data.id}.md`, holes, data });

const convocatoria = (over = {}) =>
  rec({ id: 'c1', kind: 'convocatoria', titulo: 'Convocatoria 1', status: 'watching', fit: 'high', ...over });
const evento = (over = {}) =>
  rec({ id: 'galera', kind: 'evento', titulo: 'Galera', status: 'candidate', fit: 'high', deadline: '2026-09-27', ...over });
const entidad = (over = {}) =>
  rec({ id: 'epa', kind: 'entidad', titulo: 'EPA!', relacion: 'contactado', fit: 'high', ...over });
const propuesta = (over = {}, holes = 0) =>
  rec({ id: 'p1', kind: 'propuesta', titulo: 'Formulario', status: 'borrador', para: 'galera', ...over }, holes);
const busqueda = (over = {}) =>
  rec({
    id: '2026-09-barrido',
    kind: 'busqueda',
    titulo: 'Barrido de septiembre',
    ejecutada: '2026-09-21',
    revisar: '2026-10-06',
    fuentes: 'BOE; MITECO',
    sinHallazgos: 'ENISA (persona física no elegible)',
    ...over,
  });

describe('buildSnapshot counts and grouping', () => {
  it('groups by kind and counts each', () => {
    const snap = buildSnapshot([convocatoria(), evento(), entidad(), propuesta(), busqueda()], TODAY);
    assert.deepEqual(snap.counts, { convocatoria: 1, evento: 1, entidad: 1, propuesta: 1, busqueda: 1 });
    assert.equal(snap.byKind.entidad[0].titulo, 'EPA!');
  });

  // The panel reads a sweep's coverage off the card, so these fields have to
  // survive the generator — a búsqueda carries no deadline and no fit, and without
  // them it would render as a bare title.
  it('carries a sweep\u2019s scope, review date and misses onto its card', () => {
    const [card] = buildSnapshot([busqueda()], TODAY).byKind.busqueda;
    assert.equal(card.revisar, '2026-10-06');
    assert.equal(card.sinHallazgos, 'ENISA (persona física no elegible)');
    assert.equal(card.deadline, undefined);
  });

  it('stamps a date, not a timestamp, so a rerun makes no diff', () => {
    assert.equal(buildSnapshot([], TODAY).generatedAt, TODAY);
  });

  it('survives an empty registry', () => {
    const snap = buildSnapshot([], TODAY);
    assert.deepEqual(snap.urgente, []);
    assert.deepEqual(snap.counts.convocatoria, 0);
  });
});

describe('buildSnapshot ordering', () => {
  it('puts the soonest deadline first, ahead of a better fit with none', () => {
    const snap = buildSnapshot(
      [
        convocatoria({ id: 'sin-fecha', titulo: 'Sin fecha', fit: 'high' }),
        convocatoria({ id: 'pronto', titulo: 'Pronto', fit: 'low', deadline: '2026-09-25' }),
      ],
      TODAY,
    );
    assert.deepEqual(snap.byKind.convocatoria.map((c) => c.id), ['pronto', 'sin-fecha']);
  });

  it('falls back to fit, then to Spanish alphabetical order', () => {
    const snap = buildSnapshot(
      [
        convocatoria({ id: 'zeta', titulo: 'Zeta', fit: 'medium' }),
        convocatoria({ id: 'alfa', titulo: 'Alfa', fit: 'medium' }),
        convocatoria({ id: 'mejor', titulo: 'Mejor', fit: 'high' }),
      ],
      TODAY,
    );
    assert.deepEqual(snap.byKind.convocatoria.map((c) => c.id), ['mejor', 'alfa', 'zeta']);
  });

  it('orders two same-day deadlines deterministically rather than by input order', () => {
    const a = buildSnapshot(
      [convocatoria({ id: 'b', titulo: 'Bravo', deadline: '2026-09-23' }), convocatoria({ id: 'a', titulo: 'Alfa', deadline: '2026-09-23' })],
      TODAY,
    );
    const b = buildSnapshot(
      [convocatoria({ id: 'a', titulo: 'Alfa', deadline: '2026-09-23' }), convocatoria({ id: 'b', titulo: 'Bravo', deadline: '2026-09-23' })],
      TODAY,
    );
    assert.deepEqual(a.byKind.convocatoria.map((c) => c.id), b.byKind.convocatoria.map((c) => c.id));
  });
});

describe('buildSnapshot urgency', () => {
  it('reports days remaining for anything open inside 30 days', () => {
    const snap = buildSnapshot([evento()], TODAY);
    assert.equal(snap.urgente.length, 1);
    assert.equal(snap.urgente[0].dias, 6);
  });

  it('excludes a closed record however near its date', () => {
    assert.deepEqual(buildSnapshot([evento({ status: 'attended' })], TODAY).urgente, []);
  });

  it('lists a lapsed-but-open record as caducada, not urgente', () => {
    const snap = buildSnapshot([convocatoria({ deadline: '2026-09-01' })], TODAY);
    assert.deepEqual(snap.urgente, []);
    assert.equal(snap.caducadas.length, 1);
  });

  it('leaves an `expired` record out of both lists', () => {
    const snap = buildSnapshot([convocatoria({ deadline: '2026-09-01', status: 'expired' })], TODAY);
    assert.deepEqual(snap.urgente, []);
    assert.deepEqual(snap.caducadas, []);
  });
});

describe('buildSnapshot proposals', () => {
  it('inherits the deadline from the record named in `para`', () => {
    const snap = buildSnapshot([evento(), propuesta()], TODAY);
    const card = snap.byKind.propuesta[0];
    assert.equal(card.deadline, '2026-09-27');
    assert.equal(card.para, 'galera');
  });

  it('surfaces an inherited deadline as urgente, so a draft cannot hide', () => {
    const snap = buildSnapshot([evento(), propuesta()], TODAY);
    assert.equal(snap.urgente.some((u) => u.id === 'p1' && u.dias === 6), true);
  });

  it('carries the hole count through to the card', () => {
    const snap = buildSnapshot([evento(), propuesta({}, 20)], TODAY);
    assert.equal(snap.byKind.propuesta[0].holes, 20);
  });

  it('flags a proposal claiming `lista` while holes remain', () => {
    const snap = buildSnapshot([evento(), propuesta({ status: 'lista' }, 3)], TODAY);
    assert.equal(snap.propuestasIncompletas.length, 1);
    assert.equal(snap.propuestasIncompletas[0].holes, 3);
  });

  it('does not flag a `lista` proposal with no holes', () => {
    const snap = buildSnapshot([evento(), propuesta({ status: 'lista' }, 0)], TODAY);
    assert.deepEqual(snap.propuestasIncompletas, []);
  });

  it('leaves an `enviada` proposal out of the urgent list', () => {
    const snap = buildSnapshot([evento(), propuesta({ status: 'enviada' })], TODAY);
    assert.equal(snap.urgente.some((u) => u.id === 'p1'), false);
  });
});

describe('buildSnapshot carries only what the screen renders', () => {
  it('keeps the useful frontmatter and drops the prose body', () => {
    const snap = buildSnapshot([convocatoria({ importe: '10.000 €', convocante: 'Europa Nostra' })], TODAY);
    const card = snap.byKind.convocatoria[0];
    assert.equal(card.importe, '10.000 €');
    assert.equal(card.convocante, 'Europa Nostra');
    assert.equal('body' in card, false);
  });

  it('always carries the path, so every card can link back to the source', () => {
    const snap = buildSnapshot([convocatoria(), entidad()], TODAY);
    for (const kind of ['convocatoria', 'entidad']) {
      assert.match(snap.byKind[kind][0].path, /^project\//);
    }
  });

  it('omits absent optional fields rather than emitting nulls', () => {
    const card = buildSnapshot([convocatoria()], TODAY).byKind.convocatoria[0];
    assert.equal('importe' in card, false);
    assert.equal('deadline' in card, false);
  });
});

describe('buildSnapshot fiestas', () => {
  const dataset = {
    referencia: 'Matabuena',
    actualizado: '2026-09-21',
    nota: 'El BOP no es la semana de fiestas.',
    pueblos: [
      { nombre: 'Gallegos', provincia: 'Segovia', km: 3.4, habitantes: 96, anillo: '1',
        fiestas: [{ md: '06-24', nombre: 'San Juan', fuente: 'bop' }] },
    ],
  };

  it('carries the pueblo dataset through untouched', () => {
    const snap = buildSnapshot([], TODAY, dataset);
    assert.deepEqual(snap.fiestas, dataset);
  });

  // Omitted, not emitted empty: the schema makes it optional so a snapshot
  // generated before the dataset existed still parses.
  it('omits the key entirely when there is no dataset', () => {
    assert.equal('fiestas' in buildSnapshot([], TODAY), false);
    assert.equal('fiestas' in buildSnapshot([], TODAY, null), false);
  });

  it('leaves the rest of the snapshot alone', () => {
    const withData = buildSnapshot([convocatoria()], TODAY, dataset);
    const without = buildSnapshot([convocatoria()], TODAY);
    assert.deepEqual(withData.byKind, without.byKind);
    assert.deepEqual(withData.counts, without.counts);
  });
});
