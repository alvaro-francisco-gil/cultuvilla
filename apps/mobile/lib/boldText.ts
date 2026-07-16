import type { Span } from './mentionText';

/**
 * Pure helpers backing the bold toolbar of a plain-text `TextInput`.
 *
 * A text block stores bold ranges in `bolds` (offset/length into `text`). Unlike
 * mentions, bold is a pure style with no payload, so spans are kept normalized —
 * sorted, merged, and non-overlapping — which makes toggling a selection a simple
 * "is this range fully bold? then subtract it, else add it" decision. As the text
 * is edited the spans ride through {@link mentionText.adjustMentions} like any
 * other span. All functions here are pure and unit-tested.
 */

/** Sort spans, drop empties, and merge touching/overlapping ranges. */
export function normalizeBolds(spans: Span[]): Span[] {
  const valid = spans.filter((s) => s.length > 0).sort((a, b) => a.offset - b.offset);
  const merged: Span[] = [];
  for (const s of valid) {
    const last = merged[merged.length - 1];
    if (last && s.offset <= last.offset + last.length) {
      last.length = Math.max(last.length, s.offset + s.length - last.offset);
    } else {
      merged.push({ offset: s.offset, length: s.length });
    }
  }
  return merged;
}

/** Whether every character in `[start, end)` is covered by a bold span. */
export function isRangeBold(bolds: Span[], start: number, end: number): boolean {
  if (end <= start) return false;
  let covered = start;
  for (const s of normalizeBolds(bolds)) {
    if (s.offset > covered) break; // gap before the next span
    covered = Math.max(covered, s.offset + s.length);
    if (covered >= end) return true;
  }
  return covered >= end;
}

/**
 * Toggle bold over `[start, end)`. If the whole range is already bold, subtract
 * it (splitting spans that straddle the edges); otherwise add it. Returns a
 * normalized span array. A collapsed range (`end <= start`) is a no-op.
 */
export function toggleBold(bolds: Span[], start: number, end: number): Span[] {
  if (end <= start) return normalizeBolds(bolds);
  if (!isRangeBold(bolds, start, end)) {
    return normalizeBolds([...bolds, { offset: start, length: end - start }]);
  }
  const out: Span[] = [];
  for (const s of normalizeBolds(bolds)) {
    const sEnd = s.offset + s.length;
    if (sEnd <= start || s.offset >= end) {
      out.push(s); // fully outside the toggled range
      continue;
    }
    if (s.offset < start) out.push({ offset: s.offset, length: start - s.offset });
    if (sEnd > end) out.push({ offset: end, length: sEnd - end });
  }
  return normalizeBolds(out);
}
