import type { NewsMark, NewsMarkType } from '@cultuvilla/shared/models/news/NewsPostDataModel';
import type { Span } from './mentionText';

/**
 * Pure helpers backing the formatting toolbar of a plain-text `TextInput`.
 *
 * A text block stores formatting ranges in `marks` (typed offset/length spans
 * into `text`). Marks of the same type are kept normalized — sorted, merged, and
 * non-overlapping — which makes toggling a selection a simple "is this range
 * fully this type? then subtract it, else add it" decision; different types
 * overlap freely (bold + italic on the same characters). As the text is edited
 * the spans ride through {@link mentionText.adjustMentions} like any other span.
 * All functions here are pure and unit-tested.
 */

/** Sort spans, drop empties, and merge touching/overlapping ranges. */
function normalizeSpans(spans: Span[]): Span[] {
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

/** Whether every character in `[start, end)` is covered by one of `spans`. */
function isSpanCovered(spans: Span[], start: number, end: number): boolean {
  if (end <= start) return false;
  let covered = start;
  for (const s of normalizeSpans(spans)) {
    if (s.offset > covered) break;
    covered = Math.max(covered, s.offset + s.length);
    if (covered >= end) return true;
  }
  return covered >= end;
}

/** Add `[start, end)` to a normalized span set, or subtract it if fully covered. */
function toggleSpan(spans: Span[], start: number, end: number): Span[] {
  if (!isSpanCovered(spans, start, end)) {
    return normalizeSpans([...spans, { offset: start, length: end - start }]);
  }
  const out: Span[] = [];
  for (const s of normalizeSpans(spans)) {
    const sEnd = s.offset + s.length;
    if (sEnd <= start || s.offset >= end) {
      out.push(s);
      continue;
    }
    if (s.offset < start) out.push({ offset: s.offset, length: start - s.offset });
    if (sEnd > end) out.push({ offset: end, length: sEnd - end });
  }
  return normalizeSpans(out);
}

function spansOfType(marks: NewsMark[], type: NewsMarkType): Span[] {
  return marks.filter((m) => m.type === type).map((m) => ({ offset: m.offset, length: m.length }));
}

/** Normalize marks per type and return them sorted (offset, then type) for stable output. */
export function normalizeMarks(marks: NewsMark[]): NewsMark[] {
  const types = [...new Set(marks.map((m) => m.type))];
  const out: NewsMark[] = [];
  for (const type of types) {
    for (const s of normalizeSpans(spansOfType(marks, type))) {
      out.push({ type, offset: s.offset, length: s.length });
    }
  }
  return out.sort((a, b) => a.offset - b.offset || a.type.localeCompare(b.type));
}

/** Whether the whole range `[start, end)` already carries `type`. */
export function isRangeMarked(marks: NewsMark[], type: NewsMarkType, start: number, end: number): boolean {
  return isSpanCovered(spansOfType(marks, type), start, end);
}

/**
 * Toggle `type` over `[start, end)`: add it if the range isn't fully that type,
 * otherwise remove it. Only spans of `type` are touched; other types are left
 * untouched. Returns a normalized mark array. A collapsed range is a no-op.
 */
export function toggleMark(marks: NewsMark[], type: NewsMarkType, start: number, end: number): NewsMark[] {
  if (end <= start) return normalizeMarks(marks);
  const others = marks.filter((m) => m.type !== type);
  const toggled = toggleSpan(spansOfType(marks, type), start, end).map(
    (s): NewsMark => ({ type, offset: s.offset, length: s.length }),
  );
  return normalizeMarks([...others, ...toggled]);
}
