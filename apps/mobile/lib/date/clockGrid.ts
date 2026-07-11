export interface ClockPosition {
  value: number;
  x: number;
  y: number;
}

/** Place values evenly around a circle: index 0 at 12-o'clock, going clockwise. */
export function clockPositions(values: number[], radius: number): ClockPosition[] {
  const n = values.length;
  return values.map((value, i) => {
    const theta = (i / n) * 2 * Math.PI;
    const x = radius * Math.sin(theta);
    const y = -radius * Math.cos(theta);
    return {
      value,
      x: Math.abs(x) < 1e-10 ? 0 : x,
      y: Math.abs(y) < 1e-10 ? 0 : y,
    };
  });
}

/** Material 24h layout. Displayed number equals the 24h value; index 0 sits at top. */
export function hourRings(): { outer: number[]; inner: number[] } {
  return {
    outer: [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    inner: [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  };
}

export function minuteTicks(step: number): number[] {
  if (step <= 0 || 60 % step !== 0) {
    throw new Error(`minuteStep must divide 60 evenly, got ${step}`);
  }
  return Array.from({ length: 60 / step }, (_, i) => i * step);
}

export function setClockHour(base: Date, hour: number): Date {
  const d = new Date(base);
  d.setHours(hour);
  d.setSeconds(0, 0);
  return d;
}

export function setClockMinute(base: Date, minute: number): Date {
  const d = new Date(base);
  d.setMinutes(minute);
  d.setSeconds(0, 0);
  return d;
}

export function roundUpToMinuteStep(base: Date, step: number): Date {
  const d = new Date(base);
  d.setSeconds(0, 0);
  const rem = d.getMinutes() % step;
  if (rem !== 0) d.setMinutes(d.getMinutes() + (step - rem));
  return d;
}
