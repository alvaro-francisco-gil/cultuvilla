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
import type { RegistrationData } from '../models/event/RegistrationDataModel';

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
  /** Injected so the export is deterministic under test. */
  generatedAt?: Date;
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

export function buildRosterExport(input: RosterExportInput): RosterExportModel {
  const {
    eventTitle,
    eventDate,
    registrations,
    phones = {},
    telephoneRequired,
    requiresPayment,
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
  if (telephoneRequired) columns.push({ key: 'phone', header: 'Teléfono', type: 'text', width: 16 });
  columns.push({ key: 'registeredAt', header: 'Fecha de alta', type: 'date', width: 20 });
  columns.push({ key: 'checkedInAt', header: 'Check-in', type: 'date', width: 20 });
  if (requiresPayment) columns.push({ key: 'paidAt', header: 'Pagado', type: 'date', width: 20 });

  const rows = registrations.map((r, index) => {
    const cells: RosterCell[] = [index + 1, r.name, STATUS_LABEL[r.status], r.isMember];
    if (telephoneRequired) cells.push(phones[r.id] ?? null);
    cells.push(r.registeredAt);
    cells.push(r.checkedInAt);
    if (requiresPayment) cells.push(r.paidAt);
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
