export interface DayCell {
  date: Date;
  inMonth: boolean;
}

/** Monday-first weekday index (Mon=0 … Sun=6). */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function buildMonthMatrix(year: number, monthZeroBased: number): DayCell[] {
  const first = new Date(year, monthZeroBased, 1);
  const lead = mondayIndex(first);
  const start = new Date(year, monthZeroBased, 1 - lead);
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ date, inMonth: date.getMonth() === monthZeroBased });
  }
  return cells;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function isDayDisabled(day: Date, minDate?: Date, maxDate?: Date): boolean {
  const t = startOfDay(day);
  if (minDate && t < startOfDay(minDate)) return true;
  if (maxDate && t > startOfDay(maxDate)) return true;
  return false;
}

export function clampMonth(
  year: number,
  monthZeroBased: number,
): { year: number; month: number } {
  const normalized = new Date(year, monthZeroBased, 1);
  return { year: normalized.getFullYear(), month: normalized.getMonth() };
}
