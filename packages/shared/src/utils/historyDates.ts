import type { HistoricalDate } from '../models/history/HistoryEntryDataModel';
import { monthLongLabels } from './format';

// Built by hand rather than through `formatDate`: a JS Date maps years 0–99
// onto 1900–1999 and Intl renders BC years as negative numbers, so neither can
// print a Roman-era date correctly.

function formatYear(year: number): string {
  return year < 0 ? `${String(-year)} a. C.` : String(year);
}

export function formatHistoricalDate(date: HistoricalDate): string {
  const year = formatYear(date.year);
  if (date.month == null) return year;
  const month = monthLongLabels()[date.month - 1]?.toLowerCase() ?? String(date.month);
  if (date.day == null) return `${month} de ${year}`;
  return `${String(date.day)} de ${month} de ${year}`;
}

export function formatHistoryEntryDate(entry: {
  start: HistoricalDate;
  end: HistoricalDate | null;
  approximate: boolean;
}): string {
  const span = entry.end
    ? `${formatHistoricalDate(entry.start)} – ${formatHistoricalDate(entry.end)}`
    : formatHistoricalDate(entry.start);
  return entry.approximate ? `h. ${span}` : span;
}

/** 1901–2000 is the 20th century; negative for BC (−1 is the 1st century a. C.). */
export function historicalCentury(year: number): number {
  return Math.sign(year) * Math.ceil(Math.abs(year) / 100);
}

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

function toRoman(n: number): string {
  let rest = n;
  let out = '';
  for (const [value, numeral] of ROMAN) {
    while (rest >= value) {
      out += numeral;
      rest -= value;
    }
  }
  return out;
}

export function historicalCenturyLabel(century: number): string {
  const label = `Siglo ${toRoman(Math.abs(century))}`;
  return century < 0 ? `${label} a. C.` : label;
}
