import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIRS,
  KIND_BY_DIR,
  NESTED_DIRS,
  OPEN_STATUSES,
  countPlaceholders,
  findDanglingProposals,
  findFalseReady,
  resolveProposalDeadlines,
  daysUntil,
  findDuplicateIds,
  findStranded,
  findUpcoming,
  parseFrontmatter,
  validateRecord,
} from '../lib/opportunities.mjs';

const doc = (frontmatter, body = '\nCuerpo.\n') => `---\n${frontmatter}\n---\n${body}`;

const convocatoria = (over = {}) => ({
  dir: 'convocatorias',
  slug: 'premio-x-2026',
  data: { id: 'premio-x-2026', kind: 'convocatoria', titulo: 'Premio X', status: 'watching', fit: 'high', ...over },
});
const entidad = (over = {}) => ({
  dir: 'entidades',
  slug: 'epa-asociacion',
  data: { id: 'epa-asociacion', kind: 'entidad', titulo: 'EPA!', relacion: 'contactado', fit: 'high', ...over },
});

describe('parseFrontmatter', () => {
  it('reads flat key: value pairs and returns the body separately', () => {
    const { data, body } = parseFrontmatter(doc('id: foo\nfit: high', '\n# Título\n'));
    assert.deepEqual(data, { id: 'foo', fit: 'high' });
    assert.equal(body.trim(), '# Título');
  });

  it('strips surrounding quotes so a title may contain a colon', () => {
    const { data } = parseFrontmatter(doc('titulo: "Encuentro EPA!: rural"'));
    assert.equal(data.titulo, 'Encuentro EPA!: rural');
  });

  it('rejects a file with no frontmatter block', () => {
    assert.throws(() => parseFrontmatter('# Solo cuerpo\n'), /no frontmatter/);
  });

  it('rejects a duplicate key rather than silently keeping the last', () => {
    assert.throws(() => parseFrontmatter(doc('fit: high\nfit: low')), /duplicate frontmatter key/);
  });

  it('rejects a line that is not `key: value`', () => {
    assert.throws(() => parseFrontmatter(doc('id: foo\njust-a-string')), /not `key: value`/);
  });

  it('ignores blank lines and comments', () => {
    const { data } = parseFrontmatter(doc('# nota\n\nid: foo'));
    assert.deepEqual(data, { id: 'foo' });
  });
});

describe('validateRecord', () => {
  it('accepts a well-formed record of each kind', () => {
    assert.deepEqual(validateRecord(convocatoria()), []);
    assert.deepEqual(validateRecord(entidad()), []);
  });

  it('requires the id to match the filename', () => {
    const problems = validateRecord(convocatoria({ id: 'otra-cosa' }));
    assert.match(problems.join('\n'), /does not match filename/);
  });

  it('requires kebab-case ids', () => {
    const problems = validateRecord({ dir: 'convocatorias', slug: 'Premio_X', data: { ...convocatoria().data, id: 'Premio_X' } });
    assert.match(problems.join('\n'), /not kebab-case/);
  });

  it('requires kind to match the directory it is filed in', () => {
    const problems = validateRecord({ ...convocatoria(), dir: 'eventos' });
    assert.match(problems.join('\n'), /lives in eventos\//);
  });

  it('reports every missing required field', () => {
    const problems = validateRecord({ dir: 'eventos', slug: 'x', data: { id: 'x', kind: 'evento' } });
    assert.match(problems.join('\n'), /`titulo`/);
    assert.match(problems.join('\n'), /`status`/);
    assert.match(problems.join('\n'), /`fit`/);
  });

  it('keeps the two lifecycles apart: `won` is meaningless for an evento', () => {
    assert.deepEqual(validateRecord(convocatoria({ status: 'won' })), []);
    const problems = validateRecord({ dir: 'eventos', slug: 'e', data: { id: 'e', kind: 'evento', titulo: 'E', status: 'won', fit: 'low' } });
    assert.match(problems.join('\n'), /status `won` is not one of/);
  });

  it('accepts `attended` for an evento but not for a convocatoria', () => {
    assert.deepEqual(
      validateRecord({ dir: 'eventos', slug: 'e', data: { id: 'e', kind: 'evento', titulo: 'E', status: 'attended', fit: 'low' } }),
      [],
    );
    assert.match(validateRecord(convocatoria({ status: 'attended' })).join('\n'), /is not one of/);
  });

  it('refuses a status on an entidad and a relacion on a convocatoria', () => {
    assert.match(validateRecord(entidad({ status: 'watching' })).join('\n'), /use `relacion`/);
    assert.match(validateRecord(convocatoria({ relacion: 'contactado' })).join('\n'), /use `status`/);
  });

  it('constrains relacion and fit to their vocabularies', () => {
    assert.match(validateRecord(entidad({ relacion: 'amigos' })).join('\n'), /relacion `amigos`/);
    assert.match(validateRecord(convocatoria({ fit: 'enorme' })).join('\n'), /fit `enorme`/);
  });

  it('requires ISO dates so daysUntil can never silently return null', () => {
    assert.match(validateRecord(convocatoria({ deadline: '9 de octubre' })).join('\n'), /not an ISO date/);
    assert.deepEqual(validateRecord(convocatoria({ deadline: '2026-10-09' })), []);
  });
});

describe('findDuplicateIds', () => {
  it('catches the same id filed in two directories', () => {
    const dupes = findDuplicateIds([
      { path: 'project/eventos/epa.md', data: { id: 'epa' } },
      { path: 'project/entidades/epa.md', data: { id: 'epa' } },
    ]);
    assert.equal(dupes.length, 1);
    assert.deepEqual(dupes[0].paths, ['project/eventos/epa.md', 'project/entidades/epa.md']);
  });

  it('is quiet when every id is unique', () => {
    assert.deepEqual(findDuplicateIds([{ path: 'a.md', data: { id: 'a' } }, { path: 'b.md', data: { id: 'b' } }]), []);
  });
});

describe('daysUntil', () => {
  it('counts whole days forward and backward', () => {
    assert.equal(daysUntil('2026-10-09', '2026-09-20'), 19);
    assert.equal(daysUntil('2026-09-20', '2026-09-20'), 0);
    assert.equal(daysUntil('2026-09-01', '2026-09-20'), -19);
  });

  it('is unaffected by DST shifts across the window', () => {
    assert.equal(daysUntil('2026-11-01', '2026-10-01'), 31);
  });
});

describe('findStranded', () => {
  const stranded = { path: 'a.md', data: { deadline: '2026-09-01', status: 'candidate' } };

  it('flags an open record whose deadline has lapsed', () => {
    assert.deepEqual(findStranded([stranded], '2026-09-20'), [stranded]);
  });

  it('leaves a closed record alone however old', () => {
    const closed = [
      { path: 'b.md', data: { deadline: '2020-01-01', status: 'lost' } },
      { path: 'c.md', data: { deadline: '2020-01-01', status: 'attended' } },
      { path: 'd.md', data: { deadline: '2020-01-01', status: 'expired' } },
    ];
    assert.deepEqual(findStranded(closed, '2026-09-20'), []);
  });

  it('ignores records with no deadline at all', () => {
    assert.deepEqual(findStranded([{ path: 'e.md', data: { status: 'watching' } }], '2026-09-20'), []);
  });
});

describe('findUpcoming', () => {
  const records = [
    { path: 'soon.md', data: { deadline: '2026-10-09', status: 'candidate' } },
    { path: 'sooner.md', data: { deadline: '2026-09-25', status: 'watching' } },
    { path: 'far.md', data: { deadline: '2027-01-01', status: 'candidate' } },
    { path: 'past.md', data: { deadline: '2026-09-01', status: 'candidate' } },
    { path: 'closed.md', data: { deadline: '2026-09-25', status: 'submitted' } },
  ];

  it('returns only open records inside the window, soonest first', () => {
    assert.deepEqual(
      findUpcoming(records, '2026-09-20').map((r) => r.path),
      ['sooner.md', 'soon.md'],
    );
  });

  it('excludes a deadline that has already lapsed (that is findStranded is job)', () => {
    assert.equal(findUpcoming(records, '2026-09-20').some((r) => r.path === 'past.md'), false);
  });

  it('honours a widened window', () => {
    assert.equal(findUpcoming(records, '2026-09-20', 200).length, 3);
  });

  it('includes a deadline that is today', () => {
    assert.equal(findUpcoming([{ path: 'hoy.md', data: { deadline: '2026-09-20', status: 'candidate' } }], '2026-09-20').length, 1);
  });
});

describe('registry vocabulary', () => {
  it('maps every directory to exactly one kind', () => {
    assert.deepEqual(DIRS, ['convocatorias', 'eventos', 'entidades', 'proposals']);
    assert.equal(new Set(Object.values(KIND_BY_DIR)).size, DIRS.length);
  });

  it('treats only pre-commitment statuses as open', () => {
    assert.deepEqual(OPEN_STATUSES, ['watching', 'candidate', 'preparing']);
  });
});

// --- proposals -------------------------------------------------------------

const propuesta = (over = {}) => ({
  dir: 'proposals',
  slug: 'chispa-galera-2026',
  data: {
    id: 'chispa-galera-2026',
    kind: 'propuesta',
    titulo: 'Formulario ¡Chispa!',
    status: 'borrador',
    para: 'epa-encuentro-galera-2026',
    ...over,
  },
});

describe('propuesta records', () => {
  it('accepts a well-formed proposal', () => {
    assert.deepEqual(validateRecord(propuesta()), []);
  });

  it('requires `para`, the record it targets', () => {
    const data = { ...propuesta().data };
    delete data.para;
    assert.match(validateRecord({ ...propuesta(), data }).join('\n'), /missing required field `para`/);
  });

  it('does not require `fit` — the convocatoria already scores that', () => {
    assert.deepEqual(validateRecord(propuesta()), []);
  });

  it('uses a readiness lifecycle, not an outcome one', () => {
    for (const status of ['borrador', 'lista', 'enviada', 'retirada']) {
      assert.deepEqual(validateRecord(propuesta({ status })), [], status);
    }
    assert.match(validateRecord(propuesta({ status: 'won' })).join('\n'), /is not one of/);
    assert.match(validateRecord(propuesta({ status: 'watching' })).join('\n'), /is not one of/);
  });

  it('refuses a restated deadline, so the date lives in one place', () => {
    assert.match(validateRecord(propuesta({ deadline: '2026-09-27' })).join('\n'), /inherits its deadline/);
  });

  it('is the only kind whose directory holds folders', () => {
    assert.deepEqual(NESTED_DIRS, ['proposals']);
    assert.equal(KIND_BY_DIR.proposals, 'propuesta');
  });
});

describe('countPlaceholders', () => {
  it('counts every unresolved marker', () => {
    assert.equal(countPlaceholders('| DNI | `[[DNI]]` |\n| Tel | `[[teléfono]]` |'), 2);
  });

  it('counts a marker carrying an explanatory note', () => {
    assert.equal(countPlaceholders('`[[confirmar: edad de Moisés]]`'), 1);
  });

  it('returns 0 for text with none, and never throws on empty input', () => {
    assert.equal(countPlaceholders('todo resuelto'), 0);
    assert.equal(countPlaceholders(''), 0);
  });

  it('does not mistake a markdown link for a placeholder', () => {
    assert.equal(countPlaceholders('[texto](https://cultuvilla.es)'), 0);
  });
});

describe('findFalseReady', () => {
  it('flags a proposal that claims `lista` while holes remain', () => {
    const records = [{ path: 'a/propuesta.md', holes: 3, data: { kind: 'propuesta', status: 'lista' } }];
    assert.equal(findFalseReady(records).length, 1);
  });

  it('accepts `lista` with zero holes', () => {
    const records = [{ path: 'a/propuesta.md', holes: 0, data: { kind: 'propuesta', status: 'lista' } }];
    assert.deepEqual(findFalseReady(records), []);
  });

  it('leaves a borrador alone — holes are expected there', () => {
    const records = [{ path: 'a/propuesta.md', holes: 9, data: { kind: 'propuesta', status: 'borrador' } }];
    assert.deepEqual(findFalseReady(records), []);
  });

  it('ignores holes in other kinds, which use them as `[[confirmar]]`', () => {
    const records = [{ path: 'e.md', holes: 4, data: { kind: 'entidad', relacion: 'sin-contacto' } }];
    assert.deepEqual(findFalseReady(records), []);
  });
});

describe('resolveProposalDeadlines', () => {
  const records = [
    { path: 'ev.md', data: { id: 'galera', kind: 'evento', deadline: '2026-09-27' } },
    { path: 'p/propuesta.md', data: { id: 'p', kind: 'propuesta', para: 'galera' } },
  ];

  it('inherits the deadline from the targeted record', () => {
    const [resolved] = resolveProposalDeadlines(records);
    assert.equal(resolved.deadline, '2026-09-27');
    assert.equal(resolved.target.path, 'ev.md');
  });

  it('yields a null deadline when the target carries none', () => {
    const [resolved] = resolveProposalDeadlines([
      { path: 'c.md', data: { id: 'miteco', kind: 'convocatoria' } },
      { path: 'p/propuesta.md', data: { id: 'p', kind: 'propuesta', para: 'miteco' } },
    ]);
    assert.equal(resolved.deadline, null);
    assert.ok(resolved.target);
  });
});

describe('findDanglingProposals', () => {
  it('catches a `para` pointing at nothing — a typo in an id', () => {
    const dangling = findDanglingProposals([
      { path: 'p/propuesta.md', data: { id: 'p', kind: 'propuesta', para: 'no-existe' } },
    ]);
    assert.deepEqual(dangling, [{ path: 'p/propuesta.md', para: 'no-existe' }]);
  });

  it('is quiet when every `para` resolves', () => {
    assert.deepEqual(
      findDanglingProposals([
        { path: 'ev.md', data: { id: 'galera', kind: 'evento' } },
        { path: 'p/propuesta.md', data: { id: 'p', kind: 'propuesta', para: 'galera' } },
      ]),
      [],
    );
  });
});
