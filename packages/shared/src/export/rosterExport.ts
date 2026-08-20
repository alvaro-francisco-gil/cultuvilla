/**
 * Attendee-roster export model: the one place that decides which columns an
 * event roster export has, in which order, and how each cell is typed.
 *
 * It is deliberately format-agnostic — cells keep their native JS type so the
 * xlsx writer can emit real dates/booleans that Excel can sort and filter,
 * while the CSV serializer below renders the same model as es-ES text. Adding
 * a column here adds it to both outputs.
 */
import { formatDate } from '../utils/format';
import { OPEN_SEAT_NAME } from '../models/event/RegistrationDataModel';
import type { RegistrationData } from '../models/event/RegistrationDataModel';
import type {
  SignupAnswers,
  SignupAnswerValue,
  SignupFieldSpec,
  SignupFieldType,
} from '../models/event/SignupFieldModel';

export type RosterCell = string | number | boolean | Date | null;

export type RosterColumnType = 'text' | 'number' | 'date' | 'boolean';

export interface RosterColumn {
  key: string;
  header: string;
  type: RosterColumnType;
  /** Character width hint consumed by the xlsx writer. */
  width: number;
}

export interface RosterExportModel {
  /** Base file name, extension-less and filesystem-safe. */
  fileName: string;
  /** Title row printed above the table in the xlsx sheet. */
  title: string;
  /** Second line of the sheet header: event date + generation stamp. */
  subtitle: string;
  sheetName: string;
  columns: RosterColumn[];
  rows: RosterCell[][];
  /** Confirmed / waitlisted / total, rendered as a summary line under the table. */
  totals: { confirmed: number; waitlisted: number; total: number };
}

export interface RosterExportInput {
  eventTitle: string;
  eventDate: Date | null;
  registrations: (RegistrationData & { id: string })[];
  /** Registration id -> phone, only populated when the event collected them. */
  phones?: Record<string, string | null>;
  telephoneRequired: boolean;
  requiresPayment: boolean;
  /** The event's creator-defined questions; each becomes a trailing column. */
  signupFields?: SignupFieldSpec[];
  /** Registration id -> that attendee's answers, keyed by field id. */
  answers?: Record<string, SignupAnswers>;
  /** Injected so the export is deterministic under test. */
  generatedAt?: Date;
}

/**
 * A question's answer column is typed from its spec so Excel can sort it:
 * 'select' is a constrained string and 'checkbox' a real boolean.
 */
const ANSWER_COLUMN_TYPE: Record<SignupFieldType, RosterColumnType> = {
  text: 'text',
  number: 'number',
  date: 'date',
  select: 'text',
  checkbox: 'boolean',
};

/**
 * Two questions may legally carry the same label, which would print two
 * identical headers; disambiguate the repeats rather than silently shipping an
 * unreadable sheet.
 */
function dedupeHeader(label: string, used: Map<string, number>): string {
  const seen = used.get(label) ?? 0;
  used.set(label, seen + 1);
  return seen === 0 ? label : `${label} (${String(seen + 1)})`;
}

/**
 * Answers are stored as flat primitives, so coerce to the column's type rather
 * than trusting the stored shape. A value that can't be coerced is kept as
 * text: dropping an organizer's collected data to keep a column pure would be
 * the worse failure.
 */
function answerCell(value: SignupAnswerValue | undefined, type: RosterColumnType): RosterCell {
  if (value === undefined || value === '') return null;
  if (type === 'boolean') return typeof value === 'boolean' ? value : Boolean(value);
  if (type === 'number') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : String(value);
  }
  if (type === 'date') {
    // Written as an ISO string by the date picker and re-checked in
    // validateSignupAnswers, so this parses for any answer that went through
    // the sign-up path.
    const d = typeof value === 'string' ? new Date(value) : null;
    return d && !Number.isNaN(d.getTime()) ? d : String(value);
  }
  return String(value);
}

const STATUS_LABEL: Record<RegistrationData['status'], string> = {
  confirmed: 'Confirmado',
  waitlisted: 'Lista de espera',
};

/**
 * Excel refuses `[]:*?/\` in sheet names and truncates past 31 chars; the same
 * conservative strip keeps the download file name safe across OSes.
 */
function safeName(value: string, max: number): string {
  const cleaned = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'export').slice(0, max);
}

/**
 * Numbers the groups on this roster 1..N in first-appearance order, so the
 * sheet says "Grupo 3" rather than exposing a 20-character Firestore id. An
 * empty map means the roster has no groups at all.
 */
function buildGroupLabels(registrations: Pick<RegistrationData, 'groupId'>[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const r of registrations) {
    if (r.groupId && !labels.has(r.groupId)) labels.set(r.groupId, String(labels.size + 1));
  }
  return labels;
}

export function buildRosterExport(input: RosterExportInput): RosterExportModel {
  const {
    eventTitle,
    eventDate,
    registrations,
    phones = {},
    telephoneRequired,
    requiresPayment,
    signupFields = [],
    answers = {},
    generatedAt = new Date(),
  } = input;

  const columns: RosterColumn[] = [
    // A plain row counter, not the registration's stored `position`: that field
    // is derived from the registration count at write time, so a cancellation
    // frees a number a later sign-up reuses. Numbering the exported rows keeps
    // "Nº 4" meaning the fourth row of this sheet.
    { key: 'row', header: 'Nº', type: 'number', width: 6 },
    { key: 'name', header: 'Nombre', type: 'text', width: 32 },
    { key: 'status', header: 'Estado', type: 'text', width: 16 },
    { key: 'isMember', header: 'Del pueblo', type: 'boolean', width: 12 },
  ];
  // Only on an event that seats groups: an extra always-empty column on every
  // ordinary roster would be noise the organizer has to explain away.
  const groupLabels = buildGroupLabels(registrations);
  if (groupLabels.size > 0) {
    columns.push({ key: 'group', header: 'Grupo', type: 'text', width: 10 });
  }
  if (telephoneRequired) columns.push({ key: 'phone', header: 'Teléfono', type: 'text', width: 16 });
  columns.push({ key: 'registeredAt', header: 'Fecha de alta', type: 'date', width: 20 });
  columns.push({ key: 'checkedInAt', header: 'Check-in', type: 'date', width: 20 });
  if (requiresPayment) columns.push({ key: 'paidAt', header: 'Pagado', type: 'date', width: 20 });

  // Question columns trail the fixed ones, in the creator's declared order, so
  // adding a question never shifts the columns an organizer already reads.
  const usedHeaders = new Map<string, number>();
  for (const field of signupFields) {
    columns.push({
      key: `answer:${field.id}`,
      header: dedupeHeader(field.label, usedHeaders),
      type: ANSWER_COLUMN_TYPE[field.type],
      width: field.type === 'checkbox' ? 12 : 24,
    });
  }

  const rows = registrations.map((r, index) => {
    const cells: RosterCell[] = [
      index + 1,
      // An unclaimed seat is a real, paid-for place on the roster; naming it
      // as such is more use to the organizer at the door than a blank.
      r.isOpenSeat ? OPEN_SEAT_NAME : r.name,
      STATUS_LABEL[r.status],
      r.isMember,
    ];
    if (groupLabels.size > 0) cells.push(r.groupId ? (groupLabels.get(r.groupId) ?? '') : '');
    if (telephoneRequired) cells.push(phones[r.id] ?? null);
    cells.push(r.registeredAt);
    cells.push(r.checkedInAt);
    if (requiresPayment) cells.push(r.paidAt);
    // Keyed by the stable field id, so a relabeled question keeps the answers
    // already collected under it.
    const given = answers[r.id] ?? {};
    for (const field of signupFields) {
      cells.push(answerCell(given[field.id], ANSWER_COLUMN_TYPE[field.type]));
    }
    return cells;
  });

  const confirmed = registrations.filter((r) => r.status === 'confirmed').length;

  return {
    fileName: `asistentes-${safeName(eventTitle, 60).replace(/ /g, '-').toLowerCase()}`,
    title: eventTitle,
    subtitle: [
      eventDate ? `Evento: ${formatDate(eventDate, 'long')}` : null,
      `Generado: ${formatDate(generatedAt, 'datetime')}`,
    ]
      .filter(Boolean)
      .join('  ·  '),
    sheetName: safeName(eventTitle, 31) || 'Asistentes',
    columns,
    rows,
    totals: {
      confirmed,
      waitlisted: registrations.length - confirmed,
      total: registrations.length,
    },
  };
}

function renderCell(value: RosterCell, type: RosterColumnType): string {
  if (value === null) return '';
  if (type === 'date' && value instanceof Date) return formatDate(value, 'datetime');
  if (type === 'boolean') return value ? 'Sí' : 'No';
  return String(value);
}

/**
 * Spanish Excel reads `;` as the list separator and needs the UTF-8 BOM to
 * render accents when a CSV is opened by double-click, so both are on by
 * default. Anything containing the delimiter, a quote or a newline is quoted
 * with doubled inner quotes (RFC 4180).
 */
export function toCsv(model: RosterExportModel, options: { delimiter?: string; bom?: boolean } = {}): string {
  const { delimiter = ';', bom = true } = options;

  const escape = (value: string): string =>
    /["\n\r]/.test(value) || value.includes(delimiter) ? `"${value.replace(/"/g, '""')}"` : value;

  const lines = [
    model.columns.map((c) => escape(c.header)).join(delimiter),
    ...model.rows.map((row) =>
      // Iterate the columns, not the row: the column list is what defines the
      // cell order, and it keeps the indexing safe under noUncheckedIndexedAccess.
      model.columns.map((column, i) => escape(renderCell(row[i] ?? null, column.type))).join(delimiter),
    ),
  ];

  return `${bom ? '\uFEFF' : ''}${lines.join('\r\n')}\r\n`;
}
