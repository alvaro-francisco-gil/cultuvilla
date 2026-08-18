import { describe, it, expect } from 'vitest';
import { buildRosterExport, toCsv } from '../../src/export/rosterExport';
import type { RegistrationData } from '../../src/models/event/RegistrationDataModel';
import type { SignupFieldSpec } from '../../src/models/event/SignupFieldModel';

type Row = RegistrationData & { id: string };

function reg(overrides: Partial<Row> = {}): Row {
  return {
    id: 'r1',
    userId: 'u1',
    personId: 'p1',
    name: 'Ana Pérez',
    status: 'confirmed',
    position: 1,
    registeredAt: new Date('2026-07-02T10:30:00Z'),
    isMember: true,
    checkedInAt: null,
    paidAt: null,
    ...overrides,
  };
}

const base = {
  eventTitle: 'Fiesta de San Juan',
  eventDate: new Date('2026-06-24T20:00:00Z'),
  telephoneRequired: false,
  requiresPayment: false,
  generatedAt: new Date('2026-06-20T09:00:00Z'),
};

describe('buildRosterExport', () => {
  it('exports the full roster, confirmed and waitlisted alike', () => {
    const model = buildRosterExport({
      ...base,
      registrations: [
        reg(),
        reg({ id: 'r2', name: 'Luis', status: 'waitlisted', position: 2, isMember: false }),
      ],
    });

    expect(model.rows).toHaveLength(2);
    expect(model.rows[0].slice(0, 4)).toEqual([1, 'Ana Pérez', 'Confirmado', true]);
    expect(model.rows[1].slice(0, 4)).toEqual([2, 'Luis', 'Lista de espera', false]);
    expect(model.totals).toEqual({ confirmed: 1, waitlisted: 1, total: 2 });
  });

  // `position` is derived from the registration count at write time, so a
  // cancellation frees a number the next sign-up reuses — two rows can carry
  // the same one. The sheet numbers its own rows instead.
  it('numbers rows sequentially rather than echoing the stored position', () => {
    const model = buildRosterExport({
      ...base,
      registrations: [
        reg({ id: 'r1', name: 'Ana', position: 7 }),
        reg({ id: 'r2', name: 'Luis', position: 7 }),
        reg({ id: 'r3', name: 'Marta', position: 3 }),
      ],
    });

    expect(model.rows.map((row) => row[0])).toEqual([1, 2, 3]);
  });

  it('omits the phone column unless the event collected phones', () => {
    const keys = (telephoneRequired: boolean) =>
      buildRosterExport({ ...base, telephoneRequired, registrations: [reg()] }).columns.map((c) => c.key);

    expect(keys(false)).not.toContain('phone');
    expect(keys(true)).toContain('phone');
  });

  it('omits the paid column unless the event requires payment', () => {
    const keys = (requiresPayment: boolean) =>
      buildRosterExport({ ...base, requiresPayment, registrations: [reg()] }).columns.map((c) => c.key);

    expect(keys(false)).not.toContain('paidAt');
    expect(keys(true)).toContain('paidAt');
  });

  it('fills the phone column from the registration id, blank when unknown', () => {
    const model = buildRosterExport({
      ...base,
      telephoneRequired: true,
      registrations: [reg(), reg({ id: 'r2', name: 'Luis', position: 2 })],
      phones: { r1: '600111222' },
    });

    expect(model.rows[0][4]).toBe('600111222');
    expect(model.rows[1][4]).toBeNull();
  });

  it('keeps dates as Date cells so the xlsx writer can format them natively', () => {
    const checkedInAt = new Date('2026-06-24T20:15:00Z');
    const model = buildRosterExport({ ...base, registrations: [reg({ checkedInAt })] });

    expect(model.rows[0][4]).toBeInstanceOf(Date);
    expect(model.rows[0][5]).toBe(checkedInAt);
  });

  it('strips accents and punctuation Excel rejects from the sheet and file name', () => {
    const model = buildRosterExport({
      ...base,
      eventTitle: 'Verbena: peñas [2026] / cañón?',
      registrations: [],
    });

    expect(model.sheetName).not.toMatch(/[[\]:*?/\\]/);
    expect(model.sheetName.length).toBeLessThanOrEqual(31);
    expect(model.fileName).toBe('asistentes-verbena-penas-2026-canon');
    // The human-facing title keeps the original text.
    expect(model.title).toBe('Verbena: peñas [2026] / cañón?');
  });
});

describe('buildRosterExport with custom sign-up questions', () => {
  const field = (o: Partial<SignupFieldSpec> & { id: string }): SignupFieldSpec => ({
    label: 'Pregunta',
    type: 'text',
    required: false,
    options: [],
    ...o,
  });

  it('appends one column per question, after the fixed columns', () => {
    const model = buildRosterExport({
      ...base,
      registrations: [reg()],
      signupFields: [field({ id: 'f1', label: 'Talla' }), field({ id: 'f2', label: 'DNI' })],
      answers: { r1: { f1: 'M', f2: '12345678Z' } },
    });

    expect(model.columns.map((c) => c.header).slice(-2)).toEqual(['Talla', 'DNI']);
    expect(model.rows[0].slice(-2)).toEqual(['M', '12345678Z']);
  });

  it('keys answers by field id so a relabeled question keeps its data', () => {
    const model = buildRosterExport({
      ...base,
      registrations: [reg()],
      signupFields: [field({ id: 'f1', label: 'Talla de camiseta' })],
      answers: { r1: { f1: 'L' } },
    });

    expect(model.columns.at(-1)?.header).toBe('Talla de camiseta');
    expect(model.rows[0].at(-1)).toBe('L');
  });

  it('types each answer column from its field spec', () => {
    const model = buildRosterExport({
      ...base,
      registrations: [reg()],
      signupFields: [
        field({ id: 'n', label: 'Acompañantes', type: 'number' }),
        field({ id: 'd', label: 'Llegada', type: 'date' }),
        field({ id: 'c', label: 'Bus', type: 'checkbox' }),
        field({ id: 's', label: 'Menú', type: 'select', options: ['Vegano'] }),
      ],
      answers: { r1: { n: 2, d: '2026-06-24', c: true, s: 'Vegano' } },
    });

    expect(model.columns.slice(-4).map((c) => c.type)).toEqual([
      'number',
      'date',
      'boolean',
      'text',
    ]);
    const [n, d, c, sel] = model.rows[0].slice(-4);
    expect(n).toBe(2);
    expect(d).toBeInstanceOf(Date);
    expect(c).toBe(true);
    expect(sel).toBe('Vegano');
  });

  it('leaves an unanswered question blank rather than shifting the row', () => {
    const model = buildRosterExport({
      ...base,
      registrations: [reg(), reg({ id: 'r2', name: 'Luis' })],
      signupFields: [field({ id: 'f1', label: 'Talla' }), field({ id: 'f2', label: 'DNI' })],
      answers: { r1: { f2: '12345678Z' } },
    });

    expect(model.rows[0].slice(-2)).toEqual([null, '12345678Z']);
    // A registration with no private doc at all still gets both cells.
    expect(model.rows[1].slice(-2)).toEqual([null, null]);
    expect(model.rows[1]).toHaveLength(model.columns.length);
  });

  it('disambiguates repeated question labels', () => {
    const model = buildRosterExport({
      ...base,
      registrations: [reg()],
      signupFields: [field({ id: 'a', label: 'Talla' }), field({ id: 'b', label: 'Talla' })],
      answers: { r1: { a: 'M', b: 'L' } },
    });

    expect(model.columns.map((c) => c.header).slice(-2)).toEqual(['Talla', 'Talla (2)']);
  });

  it('keeps an uncoercible answer as text instead of dropping it', () => {
    const model = buildRosterExport({
      ...base,
      registrations: [reg()],
      signupFields: [
        field({ id: 'n', label: 'Acompañantes', type: 'number' }),
        field({ id: 'd', label: 'Llegada', type: 'date' }),
      ],
      answers: { r1: { n: 'muchos', d: 'el sábado' } },
    });

    expect(model.rows[0].slice(-2)).toEqual(['muchos', 'el sábado']);
  });

  it('adds no columns when the event asks no questions', () => {
    const without = buildRosterExport({ ...base, registrations: [reg()] });
    const empty = buildRosterExport({ ...base, registrations: [reg()], signupFields: [] });

    expect(empty.columns).toEqual(without.columns);
  });

  it('carries the answer columns into the CSV', () => {
    const model = buildRosterExport({
      ...base,
      registrations: [reg()],
      signupFields: [field({ id: 'c', label: 'Bus', type: 'checkbox' })],
      answers: { r1: { c: false } },
    });
    const [header, row] = toCsv(model).trim().split('\r\n');

    expect(header?.endsWith('Bus')).toBe(true);
    expect(row?.endsWith('No')).toBe(true);
  });
});

describe('toCsv', () => {
  it('emits a BOM and semicolon delimiter so Spanish Excel opens it correctly', () => {
    const csv = toCsv(buildRosterExport({ ...base, registrations: [reg()] }));

    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n')[0]).toBe('﻿Nº;Nombre;Estado;Del pueblo;Fecha de alta;Check-in');
  });

  it('renders booleans, dates and empty cells as es-ES text', () => {
    const csv = toCsv(buildRosterExport({ ...base, registrations: [reg()] }));
    const cells = csv.split('\r\n')[1].split(';');

    expect(cells[3]).toBe('Sí');
    expect(cells[4]).toMatch(/^2 de julio de 2026/);
    expect(cells[5]).toBe('');
  });

  it('quotes values containing the delimiter, quotes or newlines', () => {
    const csv = toCsv(
      buildRosterExport({ ...base, registrations: [reg({ name: 'Pérez; "Pepe"\nGil' })] }),
    );

    expect(csv).toContain('"Pérez; ""Pepe""\nGil"');
  });

  it('honours an explicit comma delimiter without a BOM', () => {
    const csv = toCsv(buildRosterExport({ ...base, registrations: [reg()] }), {
      delimiter: ',',
      bom: false,
    });

    expect(csv.startsWith('Nº,Nombre,')).toBe(true);
  });
});
